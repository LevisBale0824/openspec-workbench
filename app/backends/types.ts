// ---------------------------------------------------------------------------
// Backend Adapter Interface & Capabilities
// ---------------------------------------------------------------------------
// Defines the contract that every backend (OpenCode Server, CLI Bridge) must
// implement.  The UI queries `capabilities` flags to show / hide features.
// Ported from opencode-visualizer-cn/app/backends/types.ts
// ---------------------------------------------------------------------------

export type BackendKind = "opencode" | "cli-bridge";

export type BackendCapabilities = {
  projects: boolean;
  worktrees: boolean;
  sessions: boolean;
  sessionFork: boolean;
  sessionRevert: boolean;
  sessionRename: boolean;
  sessionArchive: boolean;
  sessionUnarchive: boolean;
  sessionDelete: boolean;
  sessionPin: boolean;
  sessionUnpin: boolean;
  sessionCompact: boolean;
  files: boolean;
  terminal: boolean;
  permissions: boolean;
  questions: boolean;
  todos: boolean;
  status: boolean;
  providerConfig: boolean;
  imageAttachmentsOnly: boolean;
  projectPickerCreatesSession: boolean;
  ptyExitRequiresSyntheticEvent: boolean;
  ptyRefreshArtifactsOnSuccess: boolean;
  strictSandboxPaths: boolean;
  sessionManagementMode: "standard" | "sandbox-first";
};

// ── Shared option types ──────────────────────────────────────────────────

export type BackendRequestOptions = {
  instanceDirectory?: string;
  signal?: AbortSignal;
};

export type BackendQueryValue = string | number | boolean | undefined;

export type ConfigMergeStrategy = "replace" | "upsert";

export type ListSessionsOptions = {
  directory?: string;
  instanceDirectory?: string;
  roots?: boolean;
  search?: string;
  limit?: number;
};

export type SessionUpdatePayload = {
  title?: string;
  time?: {
    archived?: number;
    pinned?: number;
  };
};

export type ProjectUpdatePayload = {
  directory?: string;
  name?: string;
  icon?: {
    url?: string;
    override?: string;
    color?: string;
  };
  commands?: {
    start?: string;
  };
};

// ── BackendAdapter interface ─────────────────────────────────────────────

export type BackendAdapter = {
  kind: BackendKind;
  label: string;
  capabilities: BackendCapabilities;

  configure?(options: {
    baseUrl?: string;
    authorization?: string;
  }): void;

  // ── Sessions ───────────────────────────────────────────────────────
  createSession(directory?: string): Promise<unknown>;
  forkSession(
    sessionId: string,
    messageId: string,
    directory?: string,
  ): Promise<unknown>;
  updateSession(
    sessionId: string,
    payload: SessionUpdatePayload,
    directory?: string,
  ): Promise<unknown>;
  deleteSession(sessionId: string, directory?: string): Promise<unknown>;
  revertSession(
    sessionId: string,
    messageId: string,
    directory?: string,
  ): Promise<unknown>;
  unrevertSession(sessionId: string, directory?: string): Promise<unknown>;
  listSessions(options?: ListSessionsOptions): Promise<unknown>;

  // ── Projects ───────────────────────────────────────────────────────
  updateProject(
    projectId: string,
    payload: ProjectUpdatePayload,
  ): Promise<unknown>;
  createWorktree(directory: string): Promise<unknown>;
  deleteWorktree(
    directory: string,
    targetDirectory: string,
  ): Promise<unknown>;

  // ── Config / Info ──────────────────────────────────────────────────
  getPathInfo?(
    options?: BackendRequestOptions,
  ): Promise<Record<string, string>>;
  getGlobalConfig?(): Promise<unknown>;
  updateGlobalConfig?(payload: Record<string, unknown>): Promise<unknown>;
  writeConfigValue?(params: {
    keyPath: string;
    value: unknown;
    mergeStrategy?: ConfigMergeStrategy;
  }): Promise<unknown>;
  batchWriteConfig?(params: {
    edits: Array<{
      keyPath: string;
      value: unknown;
      mergeStrategy?: ConfigMergeStrategy;
    }>;
  }): Promise<unknown>;

  // ── Files ──────────────────────────────────────────────────────────
  listFiles?(
    payload: { directory: string; path?: string },
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  readFileContent?(
    payload: { directory: string; path: string },
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  readFileContentBytes?(
    payload: { directory: string; path: string },
    options?: BackendRequestOptions,
  ): Promise<Uint8Array>;
  writeFileContent?(
    payload: { directory: string; path: string; content: string },
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  getSessionDiff?(payload: {
    sessionID: string;
    directory?: string;
  }): Promise<unknown>;

  // ── Project / Worktree / VCS ───────────────────────────────────────
  listProjects?(directory?: string): Promise<unknown>;
  getCurrentProject?(directory?: string): Promise<unknown>;
  getSession?(
    sessionId: string,
    directory?: string,
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  getSessionChildren?(
    sessionId: string,
    directory?: string,
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  listWorktrees?(directory: string): Promise<unknown>;
  getVcsInfo?(directory: string): Promise<unknown>;

  // ── Providers ──────────────────────────────────────────────────────
  listProviders?(): Promise<unknown>;
  listProviderAuthMethods?(options?: {
    directory?: string;
    workspace?: string;
  }): Promise<unknown>;
  authorizeProviderOAuth?(
    providerId: string,
    payload: {
      method: number;
      directory?: string;
      workspace?: string;
      inputs?: Record<string, string>;
    },
  ): Promise<unknown>;
  completeProviderOAuth?(
    providerId: string,
    payload: {
      method: number;
      code?: string;
      directory?: string;
      workspace?: string;
    },
  ): Promise<unknown>;
  setProviderAuth?(
    providerId: string,
    payload: Record<string, unknown>,
  ): Promise<unknown>;
  deleteProviderAuth?(providerId: string): Promise<unknown>;

  // ── Agents / Commands ──────────────────────────────────────────────
  listAgents?(): Promise<unknown>;
  listCommands?(directory?: string): Promise<unknown>;

  // ── Status / Permissions / Questions ───────────────────────────────
  getSessionStatusMap?(
    directory?: string,
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  listPendingPermissions?(directory?: string): Promise<unknown>;
  listPendingQuestions?(directory?: string): Promise<unknown>;

  // ── Messages / Parts ───────────────────────────────────────────────
  listSessionMessages?(
    sessionId: string,
    options?: { directory?: string; limit?: number },
  ): Promise<unknown>;
  getSessionMessage?(
    sessionId: string,
    messageId: string,
    directory?: string,
  ): Promise<unknown>;
  getSessionTodos?(
    sessionId: string,
    directory?: string,
  ): Promise<unknown>;

  // ── PTY ────────────────────────────────────────────────────────────
  listPtys?(directory?: string): Promise<unknown>;
  createPty?(
    payload: {
      directory?: string;
      cwd?: string;
      command?: string;
      args?: string[];
      title?: string;
    },
    options?: BackendRequestOptions,
  ): Promise<unknown>;
  updatePtySize?(
    ptyId: string,
    payload: { directory?: string; rows: number; cols: number },
  ): Promise<unknown>;
  deletePty?(ptyId: string, directory?: string): Promise<unknown>;
  createPtyWebSocketUrl?(
    path: string,
    params?: Record<string, BackendQueryValue>,
    credentials?: { username: string; password: string },
  ): string;

  // ── Execution ──────────────────────────────────────────────────────
  runOneShotCommand?(payload: {
    directory?: string;
    command: string;
    args: string[];
  }): Promise<string>;
  sendCommand?(
    sessionId: string,
    payload: {
      directory?: string;
      command: string;
      arguments: string;
      agent?: string;
      model?: string;
      variant?: string;
    },
  ): Promise<void>;
  sendPromptAsync?(
    sessionId: string,
    payload: {
      directory: string;
      agent: string;
      model?: { providerID?: string; modelID: string };
      variant?: string;
      parts: Array<Record<string, unknown>>;
    },
  ): Promise<void>;
  abortSession?(sessionId: string, directory?: string): Promise<void>;
  patchMessagePart?(payload: {
    sessionID: string;
    messageID: string;
    partID: string;
    part: Record<string, unknown>;
    directory?: string;
  }): Promise<unknown>;

  // ── Permission / Question replies ──────────────────────────────────
  replyPermission?(
    requestId: string,
    payload: { directory?: string; reply: string },
  ): Promise<void>;
  replyQuestion?(
    requestId: string,
    payload: { directory?: string; answers: string[][] },
  ): Promise<void>;
  rejectQuestion?(
    requestId: string,
    directory?: string,
  ): Promise<void>;

  // ── Health / MCP / LSP / Skills ────────────────────────────────────
  getGlobalHealth?(): Promise<{ healthy: boolean; version: string }>;
  getMcpStatus?(): Promise<unknown>;
  getLspStatus?(): Promise<unknown>;
  updateMcp?(payload: {
    name: string;
    config: Record<string, unknown>;
  }): Promise<unknown>;
  getSkillStatus?(): Promise<unknown>;
  updateSkill?(payload: {
    path: string;
    name?: string;
    enabled: boolean;
  }): Promise<unknown>;
};
