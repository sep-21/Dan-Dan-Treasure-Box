const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync, mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const isDev = !app.isPackaged;
const shouldUseDevServer = isDev && process.env.npm_lifecycle_event === "dev";

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: "FrameForge",
    backgroundColor: "#f6f4ee",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (shouldUseDevServer) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function resolveTool(name) {
  if (name === "ffmpeg") {
    try {
      return require("ffmpeg-static") || name;
    } catch (_error) {
      try {
        return require("@ffmpeg-installer/ffmpeg").path || name;
      } catch (_innerError) {
        return name;
      }
    }
  }

  if (name === "ffprobe") {
    try {
      return require("ffprobe-static").path || name;
    } catch (_error) {
      try {
        return require("@ffprobe-installer/ffprobe").path || name;
      } catch (_innerError) {
        return name;
      }
    }
  }

  if (name === "gif2webp") {
    try {
      const mod = require("gif2webp-bin");
      return mod.default || mod || name;
    } catch (_error) {
      return name;
    }
  }

  if (name === "cwebp") {
    try {
      const mod = require("cwebp-bin");
      return mod.default || mod || name;
    } catch (_error) {
      return name;
    }
  }

  if (name === "gifski") {
    const exe = process.platform === "win32" ? "gifski.exe" : "gifski";
    const platformDir =
      process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "debian";
    const local = path.join(app.getAppPath(), "node_modules", "gifski", "bin", platformDir, exe);
    return existsSync(local) ? local : name;
  }

  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const local = path.join(process.resourcesPath || app.getAppPath(), "bin", exe);
  return existsSync(local) ? local : exe;
}

function runTool(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

ipcMain.handle("select-media", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose a media file",
    properties: ["openFile"],
    filters: [
      { name: "Media", extensions: ["mp4", "mov", "webm", "mkv", "gif", "webp"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];

  return mediaFromPath(filePath);
});

function mediaFromPath(filePath) {
  return {
    path: filePath,
    url: pathToFileURL(filePath).href,
    name: path.basename(filePath),
  };
}

ipcMain.handle("media-from-path", async (_event, filePath) => mediaFromPath(filePath));

ipcMain.handle("select-output", async (_event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: "Choose export location",
    defaultPath: defaultName || "frameforge-output.mp4",
  });

  return result.canceled ? null : result.filePath;
});

ipcMain.handle("probe-media", async (_event, filePath) => {
  const ffprobe = resolveTool("ffprobe");
  const { stdout } = await runTool(ffprobe, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  return JSON.parse(stdout);
});

ipcMain.handle("crop-mp4", async (_event, payload) => {
  const ffmpeg = resolveTool("ffmpeg");
  const filters = [];
  const shouldCrop = payload.crop !== false;
  if (shouldCrop) {
    filters.push(`crop=${payload.width}:${payload.height}:${payload.x}:${payload.y}`);
  }
  const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
  for (const box of boxes) {
    const color = String(box.color || "#000000").replace("#", "0x");
    const x = Math.max(0, Math.round(Number(box.x || 0)));
    const y = Math.max(0, Math.round(Number(box.y || 0)));
    const width = Math.max(2, Math.round(Number(box.width || 2)));
    const height = Math.max(2, Math.round(Number(box.height || 2)));
    filters.push(`drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${color}:t=fill`);
  }
  const videoFilter = filters.join(",");

  const args = [
    "-y",
    "-i",
    payload.inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-crf",
    String(payload.crf || 23),
    "-preset",
    payload.preset || "medium",
    payload.outputPath,
  ];

  if (payload.keepAudio) {
    args.splice(args.length - 1, 0, "-c:a", "copy");
  } else {
    args.splice(args.length - 1, 0, "-an");
  }

  if (videoFilter) {
    args.splice(3, 0, "-vf", videoFilter);
  }

  await runTool(ffmpeg, args);

  return { outputPath: payload.outputPath };
});

ipcMain.handle("compress-animation", async (_event, payload) => {
  const ffmpeg = resolveTool("ffmpeg");
  const width = Number(payload.width || 720);
  const height = Number(payload.height || 0);
  const fps = Number(payload.fps || 15);
  const quality = Number(payload.quality || 70);
  const ext = path.extname(payload.outputPath).toLowerCase();
  const scale = height > 0 ? `scale=${width}:${height}:flags=lanczos` : `scale=${width}:-2:flags=lanczos`;
  const gifScale = height > 0 ? `scale=${width}:${height}:flags=lanczos` : `scale=${width}:-1:flags=lanczos`;

  if (ext === ".mp4") {
    await runTool(ffmpeg, [
      "-y",
      "-i",
      payload.inputPath,
      "-vf",
      `fps=${fps},${scale}`,
      "-c:v",
      "libx264",
      "-crf",
      String(Math.max(18, Math.min(35, 38 - Math.round(quality / 5)))),
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      "-an",
      payload.outputPath,
    ]);
  } else if (ext === ".webp") {
    const gif2webp = resolveTool("gif2webp");
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "frameforge-"));
    const tempGif = path.join(tmpDir, "intermediate.gif");
    try {
      await runTool(ffmpeg, [
        "-y",
        "-i",
        payload.inputPath,
        "-vf",
        `fps=${fps},${gifScale},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
        tempGif,
      ]);
      await runTool(gif2webp, ["-q", String(quality), "-m", "6", tempGif, "-o", payload.outputPath]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  } else {
    await runTool(ffmpeg, [
      "-y",
      "-i",
      payload.inputPath,
      "-vf",
      `fps=${fps},${gifScale},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
      payload.outputPath,
    ]);
  }

  return { outputPath: payload.outputPath };
});

ipcMain.handle("video-to-gif", async (_event, payload) => {
  const ffmpeg = resolveTool("ffmpeg");
  const width = Number(payload.width || 640);
  const fps = Number(payload.fps || 12);
  const quality = Math.max(1, Math.min(100, Number(payload.quality || 72)));
  const maxColors = Math.max(32, Math.min(256, Math.round(32 + (quality / 100) * 224)));
  const start = String(payload.start || "0");
  const duration = String(payload.duration || "5");

  await runTool(ffmpeg, [
    "-y",
    "-ss",
    start,
    "-t",
    duration,
    "-i",
    payload.inputPath,
    "-vf",
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${maxColors}[p];[s1][p]paletteuse=dither=bayer`,
    payload.outputPath,
  ]);

  return { outputPath: payload.outputPath };
});

ipcMain.handle("tool-status", async () => {
  const checks = {};
  for (const tool of ["ffmpeg", "ffprobe", "gif2webp", "cwebp", "gifski"]) {
    const command = resolveTool(tool);
    checks[tool] = {
      command,
      exists: command !== tool || existsSync(command),
    };
  }
  return checks;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
