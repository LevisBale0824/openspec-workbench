export type DirEntry = {
  name: string;
  kind: "file" | "directory";
  /** POSIX-style path relative to the opened root. */
  path: string;
};

export type WorkspaceFileDiff = {
  file: string;
  before?: string;
  after?: string;
  patch?: string;
  additions: number;
  deletions: number;
  status?: "added" | "deleted" | "modified";
};

export type AgentKind = "opencode" | "zero";

export type AgentConfig = {
  kind: AgentKind;
  opencodePort: number;
  zeroPort: number;
};

export type ServerStatus = {
  running: boolean;
  port: number;
  pid: number;
};

// ── OpenSpec IPC ────────────────────────────────────────────────────────
// 主类型定义在 app/types/openspec.ts,这里只 re-export IPC 边界用到的类型
export type {
  OpenSpecReadStateResult,
  OpenSpecWriteTasksResult,
  OpenSpecValidationResult,
} from "./openspec";

export interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  readDirectory: (rootPath: string, relPath: string) => Promise<DirEntry[] | null>;
  readWorkspaceDiff: (rootPath: string) => Promise<WorkspaceFileDiff[]>;
  getServerStatus: () => Promise<ServerStatus>;
  restartServer: () => Promise<ServerStatus>;
  getAgentConfig: () => Promise<AgentConfig>;
  setAgentConfig: (
    config: Partial<AgentConfig>,
  ) => Promise<{ config: AgentConfig; status: ServerStatus }>;
  /** 读取整个 openspec/ 目录的状态;无 openspec/ 时返回 null */
  readOpenSpecState: (
    rootPath: string,
  ) => Promise<import("./openspec").OpenSpecReadStateResult | null>;
  /** 写回 tasks.md;toggle 一个 task 的 checkbox 状态。成功 ok=true */
  writeOpenSpecTasks: (
    rootPath: string,
    changeId: string,
    taskId: string,
    completed: boolean,
  ) => Promise<import("./openspec").OpenSpecWriteTasksResult>;
  /** 跑 `openspec validate <changeId?> --strict`;changeId 省略为全局校验 */
  runOpenSpecValidate: (
    rootPath: string,
    changeId?: string,
  ) => Promise<import("./openspec").OpenSpecValidationResult>;
  /** 在项目根启用 OpenSpec:优先 openspec init,降级到 fs 创建骨架 */
  initOpenSpec: (
    rootPath: string,
  ) => Promise<{ ok: boolean; method?: "cli" | "manual"; reason?: string }>;
  /** 无边框标题栏:窗口控制 + 最大化状态变化事件 */
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
  onOpenFolder: (callback: (path: string) => void) => () => void;
  isElectron: true;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
