// ---------------------------------------------------------------------------
// Electron Bridge — renderer-side detection and API wrapper
// ---------------------------------------------------------------------------
// Provides a unified API that works in both Electron and browser modes.
// When window.electronAPI is available (Electron), delegates to IPC.
// Otherwise returns null/false (caller should fall back to browser APIs).
// ---------------------------------------------------------------------------

export function isElectron(): boolean {
  return !!window.electronAPI?.isElectron;
}

export async function selectDirectory(): Promise<string | null> {
  if (window.electronAPI) {
    return window.electronAPI.selectDirectory();
  }
  return null;
}

export async function readDirectory(
  rootPath: string,
  relPath: string,
): Promise<import("../types/electron").DirEntry[] | null> {
  if (window.electronAPI) {
    return window.electronAPI.readDirectory(rootPath, relPath);
  }
  return null;
}

export function onOpenFolder(
  callback: (path: string) => void,
): (() => void) | null {
  if (window.electronAPI) {
    return window.electronAPI.onOpenFolder(callback);
  }
  return null;
}

export async function getServerStatus(): Promise<{
  running: boolean;
  port: number;
  pid: number;
} | null> {
  if (window.electronAPI) {
    return window.electronAPI.getServerStatus();
  }
  return null;
}

export async function restartServer(): Promise<{
  running: boolean;
  port: number;
  pid: number;
} | null> {
  if (window.electronAPI) {
    return window.electronAPI.restartServer();
  }
  return null;
}
