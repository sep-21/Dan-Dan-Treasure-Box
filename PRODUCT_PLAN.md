# Windows Animated Media Toolkit

## 1. Goal

Build a beginner-friendly Windows desktop app for common animated media tasks:

- Compress animated WebP files.
- Compress GIF files.
- Crop MP4 videos by freely drawing a rectangle over the preview.
- Convert video files to GIF.

The app must reuse mature open-source tools instead of reimplementing codecs, encoders, or video processing logic.

## 2. Product Shape

Working name: **FrameForge**

Target user:

- People who need to shrink GIF/WebP files for chat, docs, websites, or social media.
- People who want a small desktop tool instead of a professional video editor.
- Beginners who do not want to write FFmpeg commands.

Core principle:

- The UI should feel simple.
- The backend should delegate media work to proven command-line tools.
- Every export action should show the exact operation in a human-readable way for debugging and learning.

## 3. MVP Scope

Version 0.1 should include four workflows:

### 3.1 Animated File Compression

Inputs:

- `.gif`
- `.webp`

Controls:

- Output format: GIF / WebP / MP4
- Quality preset: Small / Balanced / High quality
- Max width
- FPS limit
- Loop preservation when possible

Outputs:

- Compressed file saved to user-selected path.
- Before/after file size.

### 3.2 MP4 Region Crop

Inputs:

- `.mp4`

Controls:

- Video preview.
- Free rectangle drawing over the video.
- Numeric adjustment for `x`, `y`, `width`, `height`.
- Optional audio preservation.
- Quality preset.

Output:

- New `.mp4` showing only the selected region.

### 3.3 Video To GIF

Inputs:

- `.mp4`
- Later: `.mov`, `.webm`, `.mkv`

Controls:

- Start time.
- End time.
- FPS.
- Width.
- Quality mode: Fast / High quality.

Outputs:

- `.gif`

### 3.4 Task Status

Controls:

- Current task progress.
- Cancel current task.
- Open output folder.
- Show export log.

Batch queue can wait until version 0.2.

## 4. Open-Source References

### 4.1 FFmpeg

Repo: https://github.com/FFmpeg/FFmpeg

Use for:

- MP4 crop.
- Video scaling.
- FPS reduction.
- Format conversion.
- GIF palette generation.
- WebP encoding/decoding when suitable.

Why:

- Industry-standard multimedia toolkit.
- Mature and widely used.
- Avoids reinventing codecs and media filters.

### 4.2 CompressO

Repo: https://github.com/codeforreal1/compressO

Use as reference for:

- Tauri + Vite desktop app architecture.
- Bundling platform-specific FFmpeg binaries.
- Offline media compression UX.
- License awareness: CompressO uses AGPL-3.0, so avoid copying code unless we are comfortable with AGPL obligations.

### 4.3 gifski

Repo: https://github.com/ImageOptim/gifski

Use for:

- High-quality GIF output.

Why:

- Purpose-built GIF encoder.
- Better visual quality than naive GIF generation.
- Can consume frames or FFmpeg pipe output.

### 4.4 Google libwebp

Docs: https://developers.google.com/speed/webp/docs/gif2webp

Use for:

- Animated WebP conversion/compression.
- Tools such as `gif2webp`, `webpmux`, and related WebP utilities.

### 4.5 Gifcurry

Repo: https://github.com/lettier/gifcurry

Use as reference for:

- GIF editor workflow.
- Time range, width, FPS, color count, dither, and crop controls.
- CLI parameter design.

### 4.6 VidCrop

Site: https://vidcrop.michd.me/

Use as reference for:

- Browser-style crop rectangle interaction.
- Turning a visual rectangle into FFmpeg crop parameters.

## 5. Recommended Tech Stack

Preferred route:

- Tauri
- React
- TypeScript
- Vite
- Rust command layer
- FFmpeg / FFprobe sidecars
- gifski sidecar
- libwebp sidecars where needed

Reasoning:

- Smaller Windows app than Electron.
- Good fit for offline desktop utilities.
- Rust backend can safely invoke subprocesses and stream progress.
- React makes UI iteration easy for vibe coding.

Fallback route:

- Electron
- React
- TypeScript
- FFmpeg CLI

Use Electron only if Tauri setup becomes too slow for the first prototype.

## 6. Architecture

```text
React UI
  |
  | invokes commands
  v
Tauri Rust backend
  |
  | validates inputs, builds command args, streams logs/progress
  v
Bundled CLI tools
  - ffmpeg.exe
  - ffprobe.exe
  - gifski.exe
  - gif2webp.exe
  - webpmux.exe
```

Important boundaries:

- React owns interaction and preview state.
- Rust owns filesystem paths, process execution, cancellation, and progress parsing.
- FFmpeg/gifski/libwebp own media processing.

## 7. Core Commands

### 7.1 Read Media Info

```bash
ffprobe -v error -print_format json -show_format -show_streams input.mp4
```

Use this to get:

- Width
- Height
- Duration
- FPS
- Codec
- Bitrate

### 7.2 Crop MP4

```bash
ffmpeg -y -i input.mp4 -vf "crop=WIDTH:HEIGHT:X:Y" -c:v libx264 -crf 23 -preset medium -c:a copy output.mp4
```

Notes:

- Crop values should be even numbers for H.264 compatibility.
- If audio copy fails, retry with AAC:

```bash
ffmpeg -y -i input.mp4 -vf "crop=WIDTH:HEIGHT:X:Y" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k output.mp4
```

### 7.3 Fast Video To GIF With Palette

```bash
ffmpeg -y -ss START -to END -i input.mp4 -vf "fps=FPS,scale=WIDTH:-1:flags=lanczos,palettegen" palette.png
ffmpeg -y -ss START -to END -i input.mp4 -i palette.png -filter_complex "fps=FPS,scale=WIDTH:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" output.gif
```

### 7.4 High-Quality Video To GIF With gifski

```bash
ffmpeg -y -ss START -to END -i input.mp4 -vf "fps=FPS,scale=WIDTH:-1:flags=lanczos" frame_%06d.png
gifski --fps FPS --quality QUALITY -o output.gif frame_*.png
```

Later we can avoid temporary frames by piping where practical.

### 7.5 Compress GIF

```bash
ffmpeg -y -i input.gif -vf "fps=FPS,scale=WIDTH:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=COLORS[p];[s1][p]paletteuse" output.gif
```

### 7.6 GIF To Animated WebP

```bash
gif2webp -q QUALITY -m 6 input.gif -o output.webp
```

### 7.7 Compress Animated WebP Via FFmpeg

```bash
ffmpeg -y -i input.webp -vf "fps=FPS,scale=WIDTH:-1:flags=lanczos" -c:v libwebp -quality QUALITY -loop 0 output.webp
```

## 8. UI Plan

Main layout:

- Left sidebar with four modes:
  - Compress
  - Crop MP4
  - Video to GIF
  - Tasks
- Main panel changes by selected mode.
- Bottom strip shows active task and progress.

Crop UI:

- Video preview area.
- Canvas overlay for rectangle drawing.
- Side panel with crop numbers.
- Export button.

Compression UI:

- Drop zone.
- Output format segmented control.
- Quality preset.
- Max width input.
- FPS input.
- Export button.

Video to GIF UI:

- Video preview.
- Start/end time controls.
- FPS and width controls.
- Quality mode.
- Export button.

## 9. Vibe Coding Workflow

### Phase 1: Project Setup

- Create Tauri + React + TypeScript app.
- Confirm it runs locally.
- Add basic UI shell.

### Phase 2: Media Tool Abstraction

- Add Rust command for `ffprobe`.
- Add a fake/mock export command for UI testing.
- Add real FFmpeg invocation after UI is stable.

### Phase 3: MP4 Crop MVP

- Add video preview.
- Add drawable crop rectangle.
- Convert preview rectangle to real video coordinates.
- Export cropped MP4.

### Phase 4: Video To GIF

- Add time range controls.
- Add FFmpeg palette method.
- Add gifski high-quality method later.

### Phase 5: GIF/WebP Compression

- Add animated GIF compression.
- Add GIF to WebP.
- Add animated WebP re-encode.

### Phase 6: Packaging

- Bundle Windows sidecar binaries.
- Build Windows installer.
- Test on a clean Windows environment.

## 10. Risks And Decisions

- Tauri sidecar packaging on Windows needs care. We should solve this early.
- FFmpeg progress parsing is noisy. Use `-progress pipe:1` where possible.
- Crop dimensions must be rounded to even numbers.
- Animated WebP handling is less uniform than MP4/GIF, so expect more testing.
- AGPL projects are good references, but avoid code copying unless license implications are accepted.

## 11. First Implementation Milestone

The first real milestone should be:

1. App launches on desktop.
2. User can drop/select one MP4.
3. App displays video preview and metadata.
4. User draws a crop rectangle.
5. App exports cropped MP4 through FFmpeg.

This proves the hardest interaction and backend processing path. GIF/WebP compression can then reuse the same process-running infrastructure.
