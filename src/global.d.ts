export type SelectedMedia = {
  path: string;
  url: string;
  name: string;
};

export type CropPayload = {
  inputPath: string;
  outputPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  boxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  crf: number;
  preset: string;
  keepAudio: boolean;
};

export type CompressPayload = {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  quality: number;
};

export type VideoToGifPayload = {
  inputPath: string;
  outputPath: string;
  start: string;
  duration: string;
  width: number;
  fps: number;
  quality: number;
};

declare global {
  interface Window {
    frameforge: {
      selectMedia: () => Promise<SelectedMedia | null>;
      mediaFromPath: (filePath: string) => Promise<SelectedMedia>;
      getDroppedFilePath: (file: File) => string;
      selectOutput: (defaultName: string) => Promise<string | null>;
      probeMedia: (filePath: string) => Promise<any>;
      cropMp4: (payload: CropPayload) => Promise<{ outputPath: string }>;
      compressAnimation: (payload: CompressPayload) => Promise<{ outputPath: string }>;
      videoToGif: (payload: VideoToGifPayload) => Promise<{ outputPath: string }>;
      toolStatus: () => Promise<Record<string, { command: string; exists: boolean }>>;
    };
  }
}
