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

export async function readWorkspaceDiff(
  rootPath: string,
): Promise<import("../types/electron").WorkspaceFileDiff[] | null> {
  if (window.electronAPI) {
    return window.electronAPI.readWorkspaceDiff(rootPath);
  }
  return null;
}

export function onOpenFolder(callback: (path: string) => void): (() => void) | null {
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

/**
 * Switch the spawned CLI agent in the Electron main process.
 *
 * In Browser mode (no electronAPI), this is a no-op — the user is expected to
 * run `opencode serve` / `zero serve` themselves and configure the URL in
 * SettingsPanel.
 */
export async function restartAgent(kind: "opencode" | "zero"): Promise<{
  config: import("../types/electron").AgentConfig;
  status: import("../types/electron").ServerStatus;
} | null> {
  if (window.electronAPI) {
    return window.electronAPI.setAgentConfig({ kind });
  }
  return null;
}

export async function getAgentConfig(): Promise<import("../types/electron").AgentConfig | null> {
  if (window.electronAPI) {
    return window.electronAPI.getAgentConfig();
  }
  return null;
}

export async function setAgentConfig(
  config: Partial<import("../types/electron").AgentConfig>,
): Promise<{
  config: import("../types/electron").AgentConfig;
  status: import("../types/electron").ServerStatus;
} | null> {
  if (window.electronAPI) {
    return window.electronAPI.setAgentConfig(config);
  }
  return null;
}

// ── OpenSpec IPC ─────────────────────────────────────────────────────────

export async function readOpenSpecState(
  rootPath: string,
): Promise<import("../types/openspec").OpenSpecReadStateResult | null> {
  if (window.electronAPI) {
    return window.electronAPI.readOpenSpecState(rootPath);
  }
  return null;
}

export async function writeOpenSpecTasks(
  rootPath: string,
  changeId: string,
  taskId: string,
  completed: boolean,
): Promise<import("../types/openspec").OpenSpecWriteTasksResult | null> {
  if (window.electronAPI) {
    return window.electronAPI.writeOpenSpecTasks(rootPath, changeId, taskId, completed);
  }
  return null;
}

export async function runOpenSpecValidate(
  rootPath: string,
  changeId?: string,
): Promise<import("../types/openspec").OpenSpecValidationResult | null> {
  if (window.electronAPI) {
    return window.electronAPI.runOpenSpecValidate(rootPath, changeId);
  }
  return null;
}

export async function initOpenSpec(
  rootPath: string,
): Promise<{ ok: boolean; method?: "cli" | "manual"; reason?: string } | null> {
  if (window.electronAPI) {
    return window.electronAPI.initOpenSpec(rootPath);
  }
  return null;
}

// ── Frameless titlebar window controls ────────────────────────────────────

export function windowMinimize(): void {
  void window.electronAPI?.windowMinimize();
}

export function windowToggleMaximize(): void {
  void window.electronAPI?.windowToggleMaximize();
}

export function windowClose(): void {
  void window.electronAPI?.windowClose();
}

export async function windowIsMaximized(): Promise<boolean> {
  if (!window.electronAPI) return false;
  return window.electronAPI.windowIsMaximized();
}

export function onWindowMaximizeChange(callback: (isMaximized: boolean) => void): () => void {
  if (!window.electronAPI) return () => {};
  return window.electronAPI.onWindowMaximizeChange(callback);
}
