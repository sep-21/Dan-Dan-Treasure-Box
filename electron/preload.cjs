const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("frameforge", {
  selectMedia: () => ipcRenderer.invoke("select-media"),
  mediaFromPath: (filePath) => ipcRenderer.invoke("media-from-path", filePath),
  getDroppedFilePath: (file) => webUtils.getPathForFile(file),
  selectOutput: (defaultName) => ipcRenderer.invoke("select-output", defaultName),
  probeMedia: (filePath) => ipcRenderer.invoke("probe-media", filePath),
  cropMp4: (payload) => ipcRenderer.invoke("crop-mp4", payload),
  compressAnimation: (payload) => ipcRenderer.invoke("compress-animation", payload),
  videoToGif: (payload) => ipcRenderer.invoke("video-to-gif", payload),
  toolStatus: () => ipcRenderer.invoke("tool-status"),
});
