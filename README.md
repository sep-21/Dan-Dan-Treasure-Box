# FrameForge

FrameForge is a Windows-first desktop prototype for:

- animated WebP compression
- GIF compression
- MP4 editing with crop and filled rectangle overlays
- video to GIF conversion

The project intentionally delegates media processing to proven tools such as FFmpeg, FFprobe, gifski, and libwebp utilities.

## Current Status

Implemented in this prototype:

- Electron shell.
- React + TypeScript + Vite UI.
- MP4 edit workspace with crop and filled rectangle drawing.
- GIF/WebP compression workspace.
- Video-to-GIF workspace.
- File picker bridge from Electron to React.
- FFprobe metadata command.
- FFmpeg MP4 crop and filled rectangle overlay command.
- FFmpeg GIF export command.
- FFmpeg plus gif2webp animated WebP export command.
- Production frontend build.
- Project-local media binaries, so Mac development no longer requires Homebrew FFmpeg.
- Windows build workflow via GitHub Actions.

Not finished yet:

- Real progress parsing.
- Batch queue.
- Polished error messages for failed media commands.

## Development

Install dependencies:

```bash
npm install
```

Build the frontend:

```bash
npm run build
```

Preview the UI in the browser:

```bash
npm exec vite -- --host 127.0.0.1
```

Run the Electron app:

```bash
npm start
```

Run live development mode:

```bash
npm run dev
```

Build Windows packages:

```bash
npm run dist:win
```

The recommended release path is GitHub Actions. Push the repo to GitHub, open the
`Windows Build` workflow, run it, and download the `FrameForge-Windows` artifact.
That workflow runs on `windows-latest`, installs dependencies, builds the Vite
renderer, and creates NSIS plus portable Windows packages.

If Electron binary download hangs, use a mirror:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## Required Media Tools

During local development, these commands are installed from npm packages:

- `ffmpeg`
- `ffprobe`
- `gif2webp`
- `cwebp`
- `gifski`

For Windows packaging, the app reuses npm-provided platform packages when installed
on Windows. You can also place binaries under:

```text
resources/
  bin/
    ffmpeg.exe
    ffprobe.exe
    gifski.exe
    gif2webp.exe
    webpmux.exe
```

The current Electron main process first checks the packaged `resources/bin` folder,
then falls back to npm-provided packages and system `PATH`.

## First Milestone

The first milestone is to finish the MP4 edit workflow end to end:

1. Select an MP4.
2. Read metadata with FFprobe.
3. Preview the video.
4. Draw a crop rectangle or filled rectangles.
5. Convert the rectangle into real video coordinates.
6. Export an edited MP4 with FFmpeg.

After that, GIF/WebP compression and video-to-GIF can reuse the same process runner.
