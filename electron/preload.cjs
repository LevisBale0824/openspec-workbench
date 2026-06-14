// Electron preload — plain CommonJS (no build step).
// Must be CJS because contextIsolation preload scripts cannot use ESM.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectDirectory: () => ipcRenderer.invoke("selectDirectory"),
  readDirectory: (rootPath, relPath) =>
    ipcRenderer.invoke("readDirectory", rootPath, relPath || ""),
  readWorkspaceDiff: (rootPath) => ipcRenderer.invoke("readWorkspaceDiff", rootPath),
  getServerStatus: () => ipcRenderer.invoke("getServerStatus"),
  restartServer: () => ipcRenderer.invoke("restartServer"),
  getAgentConfig: () => ipcRenderer.invoke("getAgentConfig"),
  setAgentConfig: (config) => ipcRenderer.invoke("setAgentConfig", config),
  onOpenFolder: (callback) => {
    const handler = (_event, path) => callback(path);
    ipcRenderer.on("menu:openFolder", handler);
    return () => ipcRenderer.removeListener("menu:openFolder", handler);
  },
  isElectron: true,
});
