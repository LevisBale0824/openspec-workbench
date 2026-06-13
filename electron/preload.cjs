// Electron preload — plain CommonJS (no build step).
// Must be CJS because contextIsolation preload scripts cannot use ESM.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectDirectory: () => ipcRenderer.invoke("selectDirectory"),
  readDirectory: (rootPath, relPath) =>
    ipcRenderer.invoke("readDirectory", rootPath, relPath || ""),
  getServerStatus: () => ipcRenderer.invoke("getServerStatus"),
  restartServer: () => ipcRenderer.invoke("restartServer"),
  // Native menu → renderer. Returns an unsubscribe function.
  onOpenFolder: (callback) => {
    const handler = (_event, path) => callback(path);
    ipcRenderer.on("menu:openFolder", handler);
    return () => ipcRenderer.removeListener("menu:openFolder", handler);
  },
  isElectron: true,
});
