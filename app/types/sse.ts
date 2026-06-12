// ---------------------------------------------------------------------------
// SSE Packet Type Definitions
// ---------------------------------------------------------------------------
// Canonical type definitions for all SSE events sent by the OpenCode server.
// Ported from opencode-visualizer-cn/app/types/sse.ts
// ---------------------------------------------------------------------------

// ── SSE envelope ──────────────────────────────────────────────────────────

/** Outer structure of every SSE data frame from the server. */
export type SsePacket = {
  directory: string;
  payload: {
    type: string;
    properties: Record<string, unknown>;
  };
};

// ── Shared / Nested Types ─────────────────────────────────────────────────

/** Serialized error object. */
export type MessageError = {
  name: string;
  data?: Record<string, unknown>;
};

// ── ToolState (discriminated union on status) ─────────────────────────────

export type ToolStatePending = {
  status: "pending";
  input: Record<string, unknown>;
  raw: string;
};

export type ToolStateRunning = {
  status: "running";
  input: Record<string, unknown>;
  title?: string;
  metadata?: Record<string, unknown>;
  time: { start: number };
};

export type ToolStateCompleted = {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { start: number; end: number; compacted?: number };
  attachments?: FilePart[];
};

export type ToolStateError = {
  status: "error";
  input: Record<string, unknown>;
  error: string;
  metadata?: Record<string, unknown>;
  time: { start: number; end: number };
};

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;

// ── File source types ─────────────────────────────────────────────────────

export type FileSourceText = {
  value: string;
  start: number;
  end: number;
};

export type FileSource = {
  type: "file";
  path: string;
  text: FileSourceText;
};

export type SymbolSource = {
  type: "symbol";
  path: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  name: string;
  kind: number;
  text: FileSourceText;
};

export type ResourceSource = {
  type: "resource";
  clientName: string;
  uri: string;
  text: FileSourceText;
};

export type FilePartSource = FileSource | SymbolSource | ResourceSource;

// ── Domain types ──────────────────────────────────────────────────────────

export type FileDiff = {
  file: string;
  before?: string;
  after?: string;
  patch?: string;
  additions: number;
  deletions: number;
  status?: "added" | "deleted" | "modified";
};

export type SessionInfo = {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  parentID?: string;
  summary?: {
    additions: number;
    deletions: number;
    files: number;
    diffs?: FileDiff[];
  };
  share?: { url: string };
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
    pinned?: number;
  };
  permission?: PermissionRule[];
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
};

export type PermissionRule = {
  permission: string;
  pattern: string;
  action: "allow" | "deny" | "ask";
};

export type PermissionNextRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type SessionStatusInfo =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number };

export type TodoInfo = {
  content: string;
  status: string;
  priority: string;
  id: string;
};

export type PtyInfo = {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: "running" | "exited";
  pid: number;
};

export type ProjectInfo = {
  id: string;
  worktree: string;
  vcs?: "git";
  name?: string;
  icon?: {
    url?: string;
    override?: string;
    color?: string;
  };
  commands?: {
    start?: string;
  };
  time: {
    created: number;
    updated: number;
    initialized?: number;
  };
  sandboxes: string[];
};

// ── Message types ─────────────────────────────────────────────────────────

export type OutputFormatText = { type: "text" };
export type OutputFormatJsonSchema = {
  type: "json_schema";
  schema: Record<string, unknown>;
  retryCount: number;
};
export type OutputFormat = OutputFormatText | OutputFormatJsonSchema;

export type APIErrorData = {
  name: "APIError";
  data: {
    message: string;
    statusCode?: number;
    isRetryable: boolean;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    metadata?: Record<string, unknown>;
  };
};

export type UserMessageInfo = {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  format?: OutputFormat;
  summary?: {
    title?: string;
    body?: string;
    diffs: FileDiff[];
  };
  agent: string;
  model: { providerID: string; modelID: string };
  system?: string;
  tools?: Record<string, unknown>;
  variant?: string;
};

export type AssistantMessageInfo = {
  id: string;
  sessionID: string;
  role: "assistant";
  time: { created: number; completed?: number };
  error?: MessageError;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: { cwd: string; root: string };
  summary?: boolean;
  cost: number;
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  structured?: unknown;
  variant?: string;
  finish?: string;
};

export type MessageInfo = UserMessageInfo | AssistantMessageInfo;

// ── Part types (12 subtypes, discriminated on `type`) ─────────────────────

type PartBase = {
  id: string;
  sessionID: string;
  messageID: string;
};

export type TextPart = PartBase & {
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
};

export type ReasoningPart = PartBase & {
  type: "reasoning";
  text: string;
  metadata?: Record<string, unknown>;
  time: { start: number; end?: number };
};

export type ToolPart = PartBase & {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: Record<string, unknown>;
};

export type FilePart = PartBase & {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
};

export type PatchPart = PartBase & {
  type: "patch";
  hash: string;
  files: string[];
};

export type SnapshotPart = PartBase & {
  type: "snapshot";
  snapshot: string;
};

export type SubtaskPart = PartBase & {
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
};

export type AgentPart = PartBase & {
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
};

export type CompactionPart = PartBase & {
  type: "compaction";
  auto: boolean;
};

export type RetryPart = PartBase & {
  type: "retry";
  attempt: number;
  error: APIErrorData;
  time: { created: number };
};

export type StepStartPart = PartBase & {
  type: "step-start";
  snapshot?: string;
};

export type StepFinishPart = PartBase & {
  type: "step-finish";
  reason: string;
  snapshot?: string;
  cost: number;
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
};

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart
  | PatchPart
  | SnapshotPart
  | SubtaskPart
  | AgentPart
  | CompactionPart
  | RetryPart
  | StepStartPart
  | StepFinishPart;

// ── Packet types ──────────────────────────────────────────────────────────

export type MessageUpdatedPacket = { info: MessageInfo };
export type MessageRemovedPacket = { sessionID: string; messageID: string };
export type MessagePartUpdatedPacket = {
  part: MessagePart;
  delta?: string;
};
export type MessagePartDeltaPacket = {
  sessionID: string;
  messageID: string;
  partID: string;
  field: string;
  delta: string;
};
export type MessagePartRemovedPacket = {
  sessionID: string;
  messageID: string;
  partID: string;
};

export type SessionUpdatedPacket = { info: SessionInfo };
export type SessionDeletedPacket = { info: SessionInfo };
export type SessionCreatedPacket = { info: SessionInfo };
export type SessionDiffPacket = { sessionID: string; diff: FileDiff[] };
export type SessionErrorPacket = { sessionID?: string; error?: MessageError };
export type SessionStatusPacket = {
  sessionID: string;
  status: SessionStatusInfo;
};
export type SessionCompactedPacket = { sessionID: string };

export type PermissionAskedPacket = PermissionNextRequest;
export type PermissionRepliedPacket = {
  sessionID: string;
  requestID: string;
  reply: "once" | "always" | "reject";
};

export type QuestionAskedPacket = QuestionRequest;
export type QuestionRepliedPacket = {
  sessionID: string;
  requestID: string;
  answers: string[][];
};
export type QuestionRejectedPacket = {
  sessionID: string;
  requestID: string;
};

export type TodoUpdatedPacket = { sessionID: string; todos: TodoInfo[] };

export type PtyCreatedPacket = { info: PtyInfo };
export type PtyUpdatedPacket = { info: PtyInfo };
export type PtyExitedPacket = { id: string; exitCode: number };
export type PtyDeletedPacket = { id: string };

export type WorktreeReadyPacket = { name: string; branch: string };
export type WorktreeFailedPacket = { message: string };

export type ProjectUpdatedPacket = ProjectInfo;

export type VcsBranchUpdatedPacket = { branch?: string };
export type FileEditedPacket = { file: string };
export type FileWatcherUpdatedPacket = {
  file: string;
  event: "add" | "change" | "unlink";
};
export type LspUpdatedPacket = Record<string, unknown>;
export type LspDiagnosticsPacket = { serverID: string; path: string };
export type CommandExecutedPacket = {
  name: string;
  sessionID: string;
  arguments: string;
  messageID: string;
};
export type InstallationUpdatedPacket = { version: string };
export type InstallationUpdateAvailablePacket = { version: string };
export type McpToolsChangedPacket = { server: string };

export type ConnectionOpenPacket = Record<string, unknown>;
export type ConnectionErrorPacket = { message: string; statusCode?: number };
export type ConnectionReconnectedPacket = Record<string, unknown>;

// ── GlobalEventMap ────────────────────────────────────────────────────────

/** Maps every SSE event name to its strongly-typed payload. */
export type GlobalEventMap = {
  "message.updated": MessageUpdatedPacket;
  "message.removed": MessageRemovedPacket;
  "message.part.updated": MessagePartUpdatedPacket;
  "message.part.delta": MessagePartDeltaPacket;
  "message.part.removed": MessagePartRemovedPacket;
  "session.created": SessionCreatedPacket;
  "session.updated": SessionUpdatedPacket;
  "session.deleted": SessionDeletedPacket;
  "session.diff": SessionDiffPacket;
  "session.error": SessionErrorPacket;
  "session.status": SessionStatusPacket;
  "session.compacted": SessionCompactedPacket;
  "permission.asked": PermissionAskedPacket;
  "permission.replied": PermissionRepliedPacket;
  "question.asked": QuestionAskedPacket;
  "question.replied": QuestionRepliedPacket;
  "question.rejected": QuestionRejectedPacket;
  "todo.updated": TodoUpdatedPacket;
  "pty.created": PtyCreatedPacket;
  "pty.updated": PtyUpdatedPacket;
  "pty.exited": PtyExitedPacket;
  "pty.deleted": PtyDeletedPacket;
  "worktree.ready": WorktreeReadyPacket;
  "worktree.failed": WorktreeFailedPacket;
  "project.updated": ProjectUpdatedPacket;
  "vcs.branch.updated": VcsBranchUpdatedPacket;
  "file.edited": FileEditedPacket;
  "file.watcher.updated": FileWatcherUpdatedPacket;
  "lsp.updated": LspUpdatedPacket;
  "lsp.client.diagnostics": LspDiagnosticsPacket;
  "command.executed": CommandExecutedPacket;
  "installation.updated": InstallationUpdatedPacket;
  "installation.update-available": InstallationUpdateAvailablePacket;
  "mcp.tools.changed": McpToolsChangedPacket;
  "connection.open": ConnectionOpenPacket;
  "connection.error": ConnectionErrorPacket;
  "connection.reconnected": ConnectionReconnectedPacket;
};

// ── WorkerStateEventMap ───────────────────────────────────────────────────

export type WorkerStateEventMap = Pick<
  GlobalEventMap,
  | "session.created"
  | "session.updated"
  | "session.deleted"
  | "session.status"
  | "project.updated"
  | "vcs.branch.updated"
  | "permission.asked"
  | "question.asked"
  | "permission.replied"
  | "question.replied"
  | "question.rejected"
  | "worktree.ready"
>;

export type WorkerStateEventType = keyof WorkerStateEventMap;

// ── Helpers ───────────────────────────────────────────────────────────────

export function getMessageVariant(
  info: MessageInfo
): string | undefined {
  if (info.role === "user") {
    const modelVariant =
      typeof info.model === "object" && info.model
        ? (info.model as Record<string, unknown>).variant
        : undefined;
    if (typeof modelVariant === "string") return modelVariant;
  }
  return typeof info.variant === "string" ? info.variant : undefined;
}
