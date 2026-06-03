import { Crop, FileVideo, Gauge, ImageDown, Loader2, Pencil, Scissors, Square, Trash2, X } from "lucide-react";
import { DragEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CompressPayload, CropPayload, SelectedMedia, VideoToGifPayload } from "./global";

type Mode = "crop" | "compress" | "gif";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MediaInfo = {
  width: number;
  height: number;
  duration: string;
  codec: string;
  fps: string;
};

type CompletedResult = {
  media: SelectedMedia;
  title: string;
};

type DrawBox = Rect & {
  id: string;
  color: string;
};

const FILL_BOX_COLOR = "#000000";

const modes: Array<{ id: Mode; label: string; icon: typeof Crop }> = [
  { id: "crop", label: "MP4 编辑", icon: Crop },
  { id: "compress", label: "压缩动图", icon: Gauge },
  { id: "gif", label: "视频转 GIF", icon: ImageDown },
];

const initialMediaState: Record<Mode, SelectedMedia | null> = {
  crop: null,
  compress: null,
  gif: null,
};

const initialInfoState: Record<Mode, MediaInfo | null> = {
  crop: null,
  compress: null,
  gif: null,
};

const initialResultState: Record<Mode, CompletedResult | null> = {
  crop: null,
  compress: null,
  gif: null,
};

function UploadGlyph() {
  return (
    <span className="uploadBadge" aria-hidden="true">
      <svg className="uploadGlyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
        <path
          d="M27.7437 42.6064H19.8169C13.3011 42.6064 10.0452 42.6064 7.85146 40.807C7.45046 40.4779 7.08275 40.1101 6.7536 39.7091C4.95422 37.5134 4.95422 34.2595 4.95422 27.7437C4.95422 21.2299 4.95422 17.972 6.7536 15.7782C7.08275 15.3772 7.45046 15.0095 7.85146 14.6804C10.0472 12.881 13.3011 12.881 19.8169 12.881H27.7437C34.2575 12.881 37.5154 12.881 39.7092 14.6804C40.1108 15.0106 40.4767 15.3766 40.807 15.7782C42.6064 17.972 42.6064 21.2279 42.6064 27.7437C42.6064 34.2595 42.6064 37.5154 40.807 39.7091C40.4779 40.1101 40.1102 40.4779 39.7092 40.807C37.5154 42.6064 34.2595 42.6064 27.7437 42.6064Z"
          stroke="#1B3F42"
          strokeWidth="2.97254"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.95422 28.7345V20.8078C4.95422 13.3348 4.95422 9.59733 7.27677 7.27677C9.59931 4.95621 13.3348 4.95422 20.8078 4.95422H26.7529C34.2258 4.95422 37.9633 4.95422 40.2839 7.27677C42.6044 9.59931 42.6064 13.3348 42.6064 20.8078V28.7345"
          stroke="#1B3F42"
          strokeWidth="2.97254"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29.7254 26.7528C29.7254 26.7528 25.3459 20.8077 23.7803 20.8077C22.2148 20.8077 17.8353 26.7528 17.8353 26.7528M23.7803 21.7986V34.6796"
          stroke="#1B3F42"
          strokeWidth="2.97254"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function even(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function readMediaInfo(probe: any): MediaInfo | null {
  const video = probe.streams?.find((stream: any) => stream.codec_type === "video");
  if (!video) return null;

  const [num, den] = String(video.avg_frame_rate || "0/1").split("/").map(Number);
  const fps = den ? (num / den).toFixed(2) : "unknown";

  return {
    width: video.width,
    height: video.height,
    duration: probe.format?.duration ? `${Number(probe.format.duration).toFixed(2)}s` : "unknown",
    codec: video.codec_name || "unknown",
    fps,
  };
}

function roundedNumber(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

export function App() {
  const [mode, setMode] = useState<Mode>("crop");
  const [isHome, setIsHome] = useState(true);
  const [mediaByMode, setMediaByMode] = useState(initialMediaState);
  const [infoByMode, setInfoByMode] = useState(initialInfoState);
  const [resultByMode, setResultByMode] = useState(initialResultState);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [isCropEditing, setIsCropEditing] = useState(false);
  const [editTool, setEditTool] = useState<"crop" | "box">("crop");
  const [drawBoxes, setDrawBoxes] = useState<DrawBox[]>([]);
  const [draftBox, setDraftBox] = useState<Rect | null>(null);
  const [status, setStatus] = useState("准备好");
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(0);
  const [fps, setFps] = useState(12);
  const [quality, setQuality] = useState(72);
  const [compressFormat, setCompressFormat] = useState<"original" | "gif" | "webp" | "mp4">("original");
  const [scaleMode, setScaleMode] = useState<"fit" | "exact">("fit");
  const [gifStart, setGifStart] = useState("0");
  const [gifDuration, setGifDuration] = useState("5");
  const [gifQuality, setGifQuality] = useState(72);
  const [lastCroppedMedia, setLastCroppedMedia] = useState<SelectedMedia | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const cropStageRef = useRef<HTMLDivElement>(null);
  const cropMedia = mediaByMode.crop;
  const cropInfo = infoByMode.crop;
  const compressMedia = mediaByMode.compress;
  const compressInfo = infoByMode.compress;
  const gifMedia = mediaByMode.gif;
  const activeResult = isHome ? null : resultByMode[mode];

  useEffect(() => {
    setIsHome(true);
  }, []);

  useEffect(() => {
    const node = cropStageRef.current;
    if (!node || !cropInfo) {
      return;
    }

    const updateStageSize = () => {
      const bounds = node.getBoundingClientRect();
      setStageSize({
        width: bounds.width,
        height: bounds.height,
      });
    };

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cropMedia, cropInfo, isCropEditing, mode]);

  const fullSourceRect = useMemo(() => {
    if (!cropInfo) return null;
    return {
      x: 0,
      y: 0,
      width: even(cropInfo.width),
      height: even(cropInfo.height),
    };
  }, [cropInfo]);

  const realCrop = useMemo(() => {
    if (!cropInfo || stageSize.width <= 0 || stageSize.height <= 0) return null;
    if (!rect) return fullSourceRect;
    const scaleX = cropInfo.width / stageSize.width;
    const scaleY = cropInfo.height / stageSize.height;

    const x = Math.min(even(rect.x * scaleX), cropInfo.width - 2);
    const y = Math.min(even(rect.y * scaleY), cropInfo.height - 2);
    const cropWidth = Math.min(even(rect.width * scaleX), cropInfo.width - x);
    const cropHeight = Math.min(even(rect.height * scaleY), cropInfo.height - y);

    return {
      x,
      y,
      width: even(cropWidth),
      height: even(cropHeight),
    };
  }, [cropInfo, fullSourceRect, rect, stageSize]);
  const displayedCrop = realCrop ?? fullSourceRect;

  function isVideoFile(selected: SelectedMedia) {
    const ext = selected.name.split(".").pop()?.toLowerCase();
    return ext === "mp4" || ext === "mov" || ext === "webm" || ext === "mkv";
  }

  function isAnimationFile(selected: SelectedMedia) {
    const ext = selected.name.split(".").pop()?.toLowerCase();
    return ext === "gif" || ext === "webp";
  }

  function isAllowedForMode(selected: SelectedMedia, targetMode: Mode) {
    if (targetMode === "compress") return isAnimationFile(selected);
    return isVideoFile(selected);
  }

  function modeUploadHint(targetMode: Mode) {
    if (targetMode === "compress") return "请选择 GIF 或 WebP 动图文件";
    if (targetMode === "gif") return "请选择 MP4 / MOV / WebM / MKV 视频文件";
    return "请选择 MP4 / MOV / WebM / MKV 视频文件";
  }

  async function loadSelectedMedia(selected: SelectedMedia | null, targetMode: Mode = mode) {
    if (!selected) {
      setStatus("准备好");
      return;
    }
    if (!isAllowedForMode(selected, targetMode)) {
      setStatus(modeUploadHint(targetMode));
      return;
    }
    setResultByMode((current) => ({ ...current, [targetMode]: null }));
    setMediaByMode((current) => ({ ...current, [targetMode]: selected }));
    const probe = await window.frameforge.probeMedia(selected.path);
    const info = readMediaInfo(probe);
    setInfoByMode((current) => ({ ...current, [targetMode]: info }));
    if (info) {
      setWidth(info.width);
      setHeight(info.height);
      if (targetMode === "crop") {
        setIsCropEditing(false);
        setEditTool("crop");
        setDrawBoxes([]);
        setDraftBox(null);
        setRect(null);
      }
    }
    setStatus(info ? "媒体已载入" : "没有找到视频流");
  }

  function setCompletedResult(targetMode: Mode, title: string, media: SelectedMedia) {
    setResultByMode((current) => ({ ...current, [targetMode]: { title, media } }));
  }

  function continueTask(targetMode: Mode) {
    setMediaByMode((current) => ({ ...current, [targetMode]: null }));
    setInfoByMode((current) => ({ ...current, [targetMode]: null }));
    setResultByMode((current) => ({ ...current, [targetMode]: null }));
    if (targetMode === "crop") {
      setLastCroppedMedia(null);
      setIsCropEditing(false);
      setIsDrawing(false);
      setDrawStart(null);
      setEditTool("crop");
      setDrawBoxes([]);
      setDraftBox(null);
      setRect(null);
    }
    setStatus("准备好");
  }

  function removeCurrentMedia(targetMode: Mode) {
    continueTask(targetMode);
  }

  function reEdit(targetMode: Mode) {
    setResultByMode((current) => ({ ...current, [targetMode]: null }));
    setStatus("继续编辑");
  }

  function updateDimension(kind: "width" | "height", value: number, sourceInfo: MediaInfo | null) {
    const nextValue = roundedNumber(value);
    if (scaleMode === "fit" && sourceInfo) {
      const ratio = sourceInfo.width / sourceInfo.height;
      if (kind === "width") {
        setWidth(nextValue);
        setHeight(roundedNumber(nextValue / ratio));
      } else {
        setHeight(nextValue);
        setWidth(roundedNumber(nextValue * ratio));
      }
      return;
    }

    if (kind === "width") {
      setWidth(nextValue);
    } else {
      setHeight(nextValue);
    }
  }

  async function selectMedia() {
    setIsLoadingMedia(true);
    setStatus("正在读取媒体信息...");
    try {
      const selected = await window.frameforge.selectMedia();
      await loadSelectedMedia(selected, mode);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取失败");
    } finally {
      setIsLoadingMedia(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (!file) return;

    setIsLoadingMedia(true);
    setStatus("正在读取拖入的媒体...");
    try {
      const filePath = window.frameforge.getDroppedFilePath(file);
      const selected = await window.frameforge.mediaFromPath(filePath);
      await loadSelectedMedia(selected, mode);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "读取失败");
    } finally {
      setIsLoadingMedia(false);
    }
  }

  function allowDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function pointerPosition(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  }

  function startDraw(event: MouseEvent<HTMLDivElement>) {
    if (!cropInfo) return;
    const point = pointerPosition(event);
    setDrawStart(point);
    if (editTool === "box") {
      setDraftBox({ x: point.x, y: point.y, width: 2, height: 2 });
    } else {
      setRect({ x: point.x, y: point.y, width: 2, height: 2 });
    }
    setIsDrawing(true);
  }

  function moveDraw(event: MouseEvent<HTMLDivElement>) {
    if (!isDrawing || !drawStart) return;
    const point = pointerPosition(event);
    const nextRect = {
      x: Math.min(drawStart.x, point.x),
      y: Math.min(drawStart.y, point.y),
      width: Math.abs(point.x - drawStart.x),
      height: Math.abs(point.y - drawStart.y),
    };
    if (editTool === "box") {
      setDraftBox(nextRect);
    } else {
      setRect(nextRect);
    }
  }

  function finishDraw() {
    if (!isDrawing) {
      setDraftBox(null);
      setDrawStart(null);
      return;
    }

    if (cropInfo && editTool === "box") {
      if (draftBox) {
        const normalized = {
          x: Math.max(0, Math.min(draftBox.x, Math.max(0, stageSize.width - 2))),
          y: Math.max(0, Math.min(draftBox.y, Math.max(0, stageSize.height - 2))),
          width: Math.max(2, Math.min(draftBox.width, Math.max(2, stageSize.width - draftBox.x))),
          height: Math.max(2, Math.min(draftBox.height, Math.max(2, stageSize.height - draftBox.y))),
        };
        if (normalized.width > 4 && normalized.height > 4) {
          setDrawBoxes((currentBoxes) => [
            ...currentBoxes,
            { ...normalized, color: FILL_BOX_COLOR, id: `${Date.now()}-${currentBoxes.length}` },
          ]);
        }
      }
      setDraftBox(null);
    } else if (cropInfo) {
      setRect((current) =>
        current
          ? current.width > 4 && current.height > 4
            ? {
                x: Math.max(0, Math.min(current.x, Math.max(0, stageSize.width - 2))),
                y: Math.max(0, Math.min(current.y, Math.max(0, stageSize.height - 2))),
                width: Math.max(2, Math.min(current.width, Math.max(2, stageSize.width - current.x))),
                height: Math.max(2, Math.min(current.height, Math.max(2, stageSize.height - current.y))),
              }
            : null
          : null,
      );
    }
    setIsDrawing(false);
    setDrawStart(null);
  }

  function closeEditSession() {
    finishDraw();
    setIsDrawing(false);
    setDrawStart(null);
    setDraftBox(null);
    setIsCropEditing(false);
  }

  function switchEditTool(nextTool: "crop" | "box") {
    if (nextTool === editTool) return;
    finishDraw();
    if (nextTool === "crop") {
      setDraftBox(null);
      setDrawBoxes([]);
    } else {
      setRect(null);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setEditTool(nextTool);
  }

  function realDrawBoxes() {
    if (!cropInfo || !fullSourceRect || stageSize.width <= 0 || stageSize.height <= 0) return [];
    const baseRect = rect && realCrop ? realCrop : fullSourceRect;
    const scaleX = cropInfo.width / stageSize.width;
    const scaleY = cropInfo.height / stageSize.height;
    const visibleBoxes = [...drawBoxes];

    if (editTool === "box" && draftBox && draftBox.width > 4 && draftBox.height > 4) {
      visibleBoxes.push({ ...draftBox, color: FILL_BOX_COLOR, id: "active-draft-box" });
    }

    return visibleBoxes
      .map((box) => {
        const sourceX = box.x * scaleX;
        const sourceY = box.y * scaleY;
        const sourceWidth = box.width * scaleX;
        const sourceHeight = box.height * scaleY;
        const left = Math.max(sourceX, baseRect.x);
        const top = Math.max(sourceY, baseRect.y);
        const right = Math.min(sourceX + sourceWidth, baseRect.x + baseRect.width);
        const bottom = Math.min(sourceY + sourceHeight, baseRect.y + baseRect.height);
        const x = Math.round(left - baseRect.x);
        const y = Math.round(top - baseRect.y);
        return {
          x,
          y,
          width: Math.round(right - left),
          height: Math.round(bottom - top),
          color: box.color,
        };
      })
      .filter((box) => box.x >= 0 && box.y >= 0 && box.width > 1 && box.height > 1);
  }

  async function exportCrop() {
    if (!cropMedia || !fullSourceRect) return;
    const outputPath = await window.frameforge.selectOutput(cropMedia.name.replace(/\.[^.]+$/, "-edited.mp4"));
    if (!outputPath) return;
    const cropRect = rect && realCrop ? realCrop : fullSourceRect;

    const payload: CropPayload = {
      inputPath: cropMedia.path,
      outputPath,
      crop: Boolean(rect),
      ...cropRect,
      boxes: realDrawBoxes(),
      crf: 23,
      preset: "medium",
      keepAudio: true,
    };

    setIsBusy(true);
    setStatus("正在用 FFmpeg 导出编辑视频...");
    try {
      await window.frameforge.cropMp4(payload);
      const exported = await window.frameforge.mediaFromPath(outputPath);
      setLastCroppedMedia(exported);
      setCompletedResult("crop", "编辑完成", exported);
      setStatus(`导出完成：${outputPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导出失败");
    } finally {
      setIsBusy(false);
    }
  }

  function outputFormat() {
    if (compressFormat !== "original") return compressFormat;
    const ext = compressMedia?.name.split(".").pop()?.toLowerCase();
    return ext === "webp" ? ext : "gif";
  }

  async function exportCompression() {
    if (!compressMedia) return;
    const format = outputFormat();
    const outputPath = await window.frameforge.selectOutput(compressMedia.name.replace(/\.[^.]+$/, `-compressed.${format}`));
    if (!outputPath) return;

    const payload: CompressPayload = {
      inputPath: compressMedia.path,
      outputPath,
      width,
      height: scaleMode === "exact" ? height : 0,
      fps,
      quality,
    };

    setIsBusy(true);
    setStatus("正在压缩动图...");
    try {
      await window.frameforge.compressAnimation(payload);
      const exported = await window.frameforge.mediaFromPath(outputPath);
      setCompletedResult("compress", "压缩完成", exported);
      setStatus(`导出完成：${outputPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "压缩失败");
    } finally {
      setIsBusy(false);
    }
  }

  function isImageAnimation(selected: SelectedMedia | null) {
    const ext = selected?.name.split(".").pop()?.toLowerCase();
    return ext === "gif" || ext === "webp";
  }

  function renderMediaPreview(selected: SelectedMedia | null, className = "mediaPreview") {
    if (!selected) return null;
    return isImageAnimation(selected) ? (
      <img className={className} src={selected.url} alt={selected.name} />
    ) : (
      <video className={className} src={selected.url} controls />
    );
  }

  async function exportGif() {
    if (!gifMedia) return;
    const outputPath = await window.frameforge.selectOutput(gifMedia.name.replace(/\.[^.]+$/, ".gif"));
    if (!outputPath) return;

    const payload: VideoToGifPayload = {
      inputPath: gifMedia.path,
      outputPath,
      start: gifStart,
      duration: gifDuration,
      width,
      fps,
      quality: gifQuality,
    };

    setIsBusy(true);
    setStatus("正在把视频转换为 GIF...");
    try {
      await window.frameforge.videoToGif(payload);
      const exported = await window.frameforge.mediaFromPath(outputPath);
      setCompletedResult("gif", "GIF 导出完成", exported);
      setStatus(`导出完成：${outputPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "转换失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendCroppedToGif() {
    if (!lastCroppedMedia) return;
    await loadSelectedMedia(lastCroppedMedia, "gif");
    setMode("gif");
    setIsHome(false);
  }

  async function sendResultToGif(result: SelectedMedia) {
    await loadSelectedMedia(result, "gif");
    setMode("gif");
    setIsHome(false);
  }

  function openMode(nextMode: Mode) {
    setMode(nextMode);
    setIsHome(false);
  }

  function renderCompletedResult(targetMode: Mode, result: CompletedResult) {
    return (
      <section className="resultLayout">
        <div className="resultPanel">
          <div className="paneHeader">
            <h2>{result.title}</h2>
            <span>{result.media.name}</span>
          </div>
          <div className="animationFrame resultFrame">{renderMediaPreview(result.media)}</div>
          <div className="resultActions">
            <button className="exportButton" onClick={() => continueTask(targetMode)}>
              继续任务
            </button>
            <button className="secondaryButton" onClick={() => reEdit(targetMode)}>
              重新编辑
            </button>
            {targetMode === "crop" ? (
              <button className="secondaryButton" onClick={() => sendResultToGif(result.media)}>
                <ImageDown size={18} />
                转 GIF
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderFeatureIcon(featureMode: Mode) {
    if (featureMode === "crop") {
      return (
        <div className="featureObject cropObject" aria-hidden="true">
          <span className="objectToolbar" />
          <span className="objectScreen" />
          <span className="objectCut" />
          <span className="objectAxis" />
        </div>
      );
    }

    if (featureMode === "compress") {
      return (
        <div className="featureObject compressObject" aria-hidden="true">
          <span className="objectSlot" />
          <span className="objectBar one" />
          <span className="objectBar two" />
          <span className="objectBar three" />
          <span className="objectDial" />
        </div>
      );
    }

    return (
      <div className="featureObject gifObject" aria-hidden="true">
        <span className="gifFrame first" />
        <span className="gifFrame second" />
        <span>GIF</span>
        <span className="objectKnob" />
      </div>
    );
  }

  function renderHome() {
    return (
      <div className="homeView">
        <header className="homeBrand">
          <button className="brandPill" onClick={() => setIsHome(true)}>
            <span className="brandMark" aria-hidden="true" />
            <span>
              <strong>FrameForge</strong>
              <small>Media tools</small>
            </span>
          </button>
        </header>
        <section className="homeHero">
          <p>Product&UI Media Dashboard</p>
          <h1>FrameForge</h1>
        </section>
        <main className="featureLauncher">
          <button className="featureCard featureCardTall cropEntry" onClick={() => openMode("crop")}>
            {renderFeatureIcon("crop")}
            <span className="featureLabel">MP4 编辑</span>
            <span className="featureMeta">Crop / draw boxes</span>
          </button>
          <div className="featureSide">
            <button className="featureCard compressEntry" onClick={() => openMode("compress")}>
              {renderFeatureIcon("compress")}
              <span className="featureLabel">压缩动图</span>
              <span className="featureMeta">GIF / WebP optimizer</span>
            </button>
            <button className="featureCard gifEntry" onClick={() => openMode("gif")}>
              {renderFeatureIcon("gif")}
              <span className="featureLabel">视频转 GIF</span>
              <span className="featureMeta">Video to animated GIF</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (isHome) {
    return renderHome();
  }

  return (
    <div className="app toolApp">
      <header className="toolHeader">
        <button className="brandPill compactBrand" onClick={() => setIsHome(true)}>
          <span className="brandMark" aria-hidden="true" />
          <span>
            <strong>FrameForge</strong>
            <small>Media tools</small>
          </span>
        </button>

        <nav className="topNav">
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={mode === item.id ? "topNavButton active" : "topNavButton"}
                key={item.id}
                onClick={() => openMode(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="workspace">
        <div className="toolTitleRow">
          <div>
            <h1>
              {mode === "crop"
                ? "MP4 编辑"
                : mode === "compress"
                  ? "压缩动图"
                  : "视频转 GIF"}
            </h1>
            <p>导入媒体，调整参数，然后导出结果。</p>
          </div>
          <button className="primaryButton" onClick={selectMedia} disabled={isBusy || isLoadingMedia}>
            {isLoadingMedia ? <Loader2 className="spin" size={18} /> : <FileVideo size={18} />}
            {isLoadingMedia ? "正在上传" : "选择媒体"}
          </button>
        </div>

        {activeResult ? (
          renderCompletedResult(mode, activeResult)
        ) : mode === "crop" ? (
          <section className="cropLayout">
            <div className="cropWorkArea">
              {!cropMedia ? (
                <button className="uploadPanel" onClick={selectMedia} onDragOver={allowDrop} onDrop={handleDrop} disabled={isLoadingMedia}>
                  {isLoadingMedia ? <Loader2 className="spin uploadSpinner" size={48} /> : <UploadGlyph />}
                  <strong>{isLoadingMedia ? "正在上传文件" : "上传文件"}</strong>
                  <span>点击此处选择视频文件</span>
                </button>
              ) : (
                <section className="mediaPane singleMediaPane">
                  <div className="paneHeader">
                    <h2>{isCropEditing ? (editTool === "crop" ? "裁剪画框" : "绘制矩形") : "视频预览"}</h2>
                    <span>{cropMedia.name}</span>
                  </div>
                  <div className={isCropEditing ? "playbackFrame editingFrame" : "playbackFrame"}>
                    <button
                      className="frameIconButton frameDeleteButton"
                      type="button"
                      title="删除当前视频"
                      aria-label="删除当前视频"
                      onClick={() => removeCurrentMedia("crop")}
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      className="frameIconButton"
                      type="button"
                      title={isCropEditing ? "退出编辑" : "编辑视频"}
                      aria-label={isCropEditing ? "退出编辑" : "编辑视频"}
                      onClick={() => {
                        if (isCropEditing) {
                          closeEditSession();
                          return;
                        }
                        setIsCropEditing((current) => !current);
                      }}
                    >
                      {isCropEditing ? <X size={18} /> : <Pencil size={18} />}
                    </button>

                    {isCropEditing ? (
                      <div
                        className="cropStage"
                        ref={cropStageRef}
                        style={{
                          aspectRatio: cropInfo ? `${cropInfo.width} / ${cropInfo.height}` : "16 / 9",
                          height: cropInfo && cropInfo.width < cropInfo.height ? "100%" : undefined,
                          width: cropInfo && cropInfo.width >= cropInfo.height ? "100%" : undefined,
                        }}
                        onMouseDown={startDraw}
                        onMouseMove={moveDraw}
                        onMouseUp={finishDraw}
                        onMouseLeave={finishDraw}
                      >
                        <video className="cropMedia" src={cropMedia.url} muted playsInline />
                        {drawBoxes.map((box) => (
                          <div
                            className="drawBox"
                            key={box.id}
                            style={{
                              backgroundColor: box.color,
                              left: `${box.x}px`,
                              top: `${box.y}px`,
                              width: `${Math.max(2, box.width)}px`,
                              height: `${Math.max(2, box.height)}px`,
                            }}
                          />
                        ))}
                        {draftBox ? (
                          <div
                            className="drawBox draftDrawBox"
                            style={{
                              backgroundColor: FILL_BOX_COLOR,
                              left: `${draftBox.x}px`,
                              top: `${draftBox.y}px`,
                              width: `${Math.max(2, draftBox.width)}px`,
                              height: `${Math.max(2, draftBox.height)}px`,
                            }}
                          />
                        ) : null}
                        {editTool === "crop" && rect ? (
                          <div
                            className="cropBox"
                            style={{
                              left: `${rect.x}px`,
                              top: `${rect.y}px`,
                              width: `${Math.max(2, rect.width)}px`,
                              height: `${Math.max(2, rect.height)}px`,
                            }}
                          />
                        ) : null}
                      </div>
                    ) : (
                      renderMediaPreview(cropMedia, "playbackMedia")
                    )}
                    </div>
                </section>
              )}
            </div>

            <aside className="inspector">
              <h2>编辑参数</h2>
              {cropInfo ? (
                <dl className="metaGrid">
                  <div>
                    <dt>尺寸</dt>
                    <dd>
                      {cropInfo.width} x {cropInfo.height}
                    </dd>
                  </div>
                  <div>
                    <dt>时长</dt>
                    <dd>{cropInfo.duration}</dd>
                  </div>
                  <div>
                    <dt>FPS</dt>
                    <dd>{cropInfo.fps}</dd>
                  </div>
                  <div>
                    <dt>编码</dt>
                    <dd>{cropInfo.codec}</dd>
                  </div>
                </dl>
              ) : (
                <p className="muted">还没有载入媒体。</p>
              )}

              {isCropEditing ? (
                <div className="editToolPanel">
                  <div className="segmentedTools">
                    <button className={editTool === "crop" ? "active" : ""} type="button" onClick={() => switchEditTool("crop")}>
                      <Scissors size={16} />
                      裁剪
                    </button>
                    <button className={editTool === "box" ? "active" : ""} type="button" onClick={() => switchEditTool("box")}>
                      <Square size={16} />
                      矩形
                    </button>
                  </div>
                  {editTool === "crop" ? (
                    <button className="secondaryButton slimButton" type="button" onClick={() => setRect(null)} disabled={!rect}>
                      <Trash2 size={16} />
                      清除裁剪
                    </button>
                  ) : (
                    <button className="secondaryButton slimButton" type="button" onClick={() => setDrawBoxes([])} disabled={drawBoxes.length === 0}>
                      <Trash2 size={16} />
                      清空矩形
                    </button>
                  )}
                </div>
              ) : null}

              <div className="cropNumbers">
                <label>
                  X
                  <input value={displayedCrop?.x ?? 0} readOnly />
                </label>
                <label>
                  Y
                  <input value={displayedCrop?.y ?? 0} readOnly />
                </label>
                <label>
                  宽
                  <input value={displayedCrop?.width ?? 0} readOnly />
                </label>
                <label>
                  高
                  <input value={displayedCrop?.height ?? 0} readOnly />
                </label>
              </div>

              <button className="exportButton" disabled={!cropMedia || isBusy} onClick={exportCrop}>
                {isBusy ? <Loader2 className="spin" size={18} /> : <Scissors size={18} />}
                导出编辑 MP4
              </button>
              {lastCroppedMedia ? (
                <button className="secondaryButton" disabled={isBusy || isLoadingMedia} onClick={sendCroppedToGif}>
                  <ImageDown size={18} />
                  用刚裁剪的视频转 GIF
                </button>
              ) : null}
            </aside>
          </section>
        ) : mode === "compress" ? (
          <section className="toolLayout">
            <div className="toolPanel">
              <h2>压缩 GIF / WebP 动图</h2>
              <p className="muted">选择 GIF 或 WebP，设置宽度、帧率和质量，然后导出为 GIF、WebP 或 MP4。</p>
              {!compressMedia ? (
                <button
                  className="uploadPanel compactUpload"
                  onClick={selectMedia}
                  onDragOver={allowDrop}
                  onDrop={handleDrop}
                  disabled={isLoadingMedia}
                >
                  {isLoadingMedia ? <Loader2 className="spin uploadSpinner" size={48} /> : <UploadGlyph />}
                  <strong>{isLoadingMedia ? "正在上传文件" : "上传文件"}</strong>
                  <span>拖拽文件到此处或点击上传</span>
                </button>
              ) : (
                <div className="animationPreview">
                  <div className="paneHeader">
                    <h2>动效预览</h2>
                    <span>{compressMedia.name}</span>
                  </div>
                  <div className="animationFrame">
                    <button
                      className="frameIconButton frameDeleteButton"
                      type="button"
                      title="删除当前动图"
                      aria-label="删除当前动图"
                      onClick={() => removeCurrentMedia("compress")}
                    >
                      <Trash2 size={18} />
                    </button>
                    {renderMediaPreview(compressMedia)}
                  </div>
                </div>
              )}
            </div>
            <aside className="inspector">
              <h2>基础编辑</h2>
              <div className="fieldStack">
                <label>
                  格式转换
                  <select value={compressFormat} onChange={(event) => setCompressFormat(event.target.value as typeof compressFormat)}>
                    <option value="original">不转换</option>
                    <option value="gif">GIF</option>
                    <option value="webp">WebP</option>
                    <option value="mp4">MP4</option>
                  </select>
                </label>
                <label>
                  内容缩放
                  <select
                    value={scaleMode}
                    onChange={(event) => {
                      const nextMode = event.target.value as typeof scaleMode;
                      setScaleMode(nextMode);
                      if (nextMode === "fit" && compressInfo) {
                        setHeight(roundedNumber(width / (compressInfo.width / compressInfo.height)));
                      }
                    }}
                  >
                    <option value="fit">等比缩放</option>
                    <option value="exact">指定尺寸</option>
                  </select>
                </label>
                <div className="dimensionRow">
                  <label>
                    宽
                    <input value={width} onChange={(event) => updateDimension("width", Number(event.target.value), compressInfo)} />
                  </label>
                  <span>x</span>
                  <label>
                    高
                    <input value={height} onChange={(event) => updateDimension("height", Number(event.target.value), compressInfo)} />
                  </label>
                  <span>px</span>
                </div>
                <label>
                  压缩比例
                  <input value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
                </label>
                <label>
                  帧率修改
                  <input value={fps} onChange={(event) => setFps(Number(event.target.value))} />
                </label>
              </div>
              <button className="exportButton" disabled={!compressMedia || isBusy || isLoadingMedia} onClick={exportCompression}>
                {isBusy ? <Loader2 className="spin" size={18} /> : <Gauge size={18} />}
                导出压缩文件
              </button>
            </aside>
          </section>
        ) : mode === "gif" ? (
          <section className="toolLayout">
            <div className="toolPanel">
              <h2>视频转 GIF</h2>
              <p className="muted">选择视频文件，设置开始时间、截取时长、宽度和帧率。</p>
              {!gifMedia ? (
                <button
                  className="uploadPanel compactUpload"
                  onClick={selectMedia}
                  onDragOver={allowDrop}
                  onDrop={handleDrop}
                  disabled={isLoadingMedia}
                >
                  {isLoadingMedia ? <Loader2 className="spin uploadSpinner" size={48} /> : <UploadGlyph />}
                  <strong>{isLoadingMedia ? "正在上传文件" : "上传文件"}</strong>
                  <span>选择 MP4 / MOV / WebM / MKV 视频</span>
                </button>
              ) : (
                <div className="animationPreview">
                  <div className="paneHeader">
                    <h2>视频预览</h2>
                    <span>{gifMedia.name}</span>
                  </div>
                  <div className="animationFrame">
                    <button
                      className="frameIconButton frameDeleteButton"
                      type="button"
                      title="删除当前视频"
                      aria-label="删除当前视频"
                      onClick={() => removeCurrentMedia("gif")}
                    >
                      <Trash2 size={18} />
                    </button>
                    {renderMediaPreview(gifMedia)}
                  </div>
                </div>
              )}
            </div>
            <aside className="inspector">
              <h2>GIF 设置</h2>
              <div className="fieldStack">
                <label>
                  开始秒数
                  <input value={gifStart} onChange={(event) => setGifStart(event.target.value)} />
                </label>
                <label>
                  截取时长
                  <input value={gifDuration} onChange={(event) => setGifDuration(event.target.value)} />
                </label>
                <label>
                  宽度
                  <input value={width} onChange={(event) => setWidth(Number(event.target.value))} />
                </label>
                <label>
                  FPS
                  <input value={fps} onChange={(event) => setFps(Number(event.target.value))} />
                </label>
                <label>
                  GIF 质量
                  <input value={gifQuality} onChange={(event) => setGifQuality(Number(event.target.value))} />
                </label>
              </div>
              <button className="exportButton" disabled={!gifMedia || isBusy} onClick={exportGif}>
                {isBusy ? <Loader2 className="spin" size={18} /> : <ImageDown size={18} />}
                导出 GIF
              </button>
            </aside>
          </section>
        ) : null}

        <footer className="statusbar">{status}</footer>
      </main>
    </div>
  );
}
