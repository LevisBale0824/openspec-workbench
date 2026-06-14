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
  onOpenFolder: (callback: (path: string) => void) => () => void;
  isElectron: true;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
