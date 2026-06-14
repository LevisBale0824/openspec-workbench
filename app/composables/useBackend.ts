// ---------------------------------------------------------------------------
// Backend Orchestrator — top-level composable
// ---------------------------------------------------------------------------
// Wires together useGlobalEvents, useBackendActivation, useBackendSessionLifecycle,
// and useBackendMessageSend into a single reactive surface for the UI.
// ---------------------------------------------------------------------------

import { ref, readonly, watch, type Ref } from "vue";
import { useGlobalEvents } from "./useGlobalEvents";
import { useBackendActivation } from "./useBackendActivation";
import { useBackendSessionLifecycle } from "./useBackendSessionLifecycle";
import { useBackendMessageSend } from "./useBackendMessageSend";
import { useMessages } from "./useMessages";
import { useDeltaAccumulator } from "./useDeltaAccumulator";
import { useSessionStatus } from "./useSessionStatus";
import { useSessions } from "./useSessions";
import { useProject } from "./useProject";
import { isElectron as detectElectron, readWorkspaceDiff } from "../utils/electronBridge";
import {
  getActiveBackendKind,
  getActiveBackendAdapter,
  getPersistedOpenCodeUrl,
  getPersistedUrlFor,
  configureOpenCodeBackend,
  configureZeroBackend,
  setActiveBackendKind,
} from "../backends/registry";
import { StorageKeys, storageGet, storageSet } from "../utils/storageKeys";
import type { BackendKind } from "../backends/types";
import type {
  FileDiff,
  MessageUpdatedPacket,
  SessionInfo,
  SessionStatusPacket,
} from "../types/sse";

export type { ConnectionState } from "./useBackendActivation";

// ── Module-level singleton state ──────────────────────────────────────────

const electronMode = detectElectron();
const DEFAULT_URL = "http://localhost:13284";

const baseUrl = ref(electronMode ? DEFAULT_URL : getPersistedOpenCodeUrl());
const authHeader = ref(storageGet(StorageKeys.auth.opencodeAuthorization) ?? undefined);
const activeBackendKind = ref<BackendKind>(getActiveBackendKind());

// Shared refs consumed by multiple sub-composables
const selectedSessionId = ref("");
const activeDirectory = ref("");
const isAborting = ref(false);
const isSending = ref(false);
const agent = ref("general");
const modelId = ref("");
const providerId = ref("");
const variant = ref("");
const workspaceDiffs = ref<FileDiff[]>([]);

function t(key: string): string {
  return key;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function normalizeFileDiffs(value: unknown): FileDiff[] {
  if (Array.isArray(value)) return value as FileDiff[];
  const rec = toRecord(value);
  const diff = rec?.diff ?? rec?.diffs;
  return Array.isArray(diff) ? (diff as FileDiff[]) : [];
}

// ── Sub-composable instances ──────────────────────────────────────────────

const ge = useGlobalEvents({
  baseUrl,
  authHeader: authHeader as Ref<string | undefined>,
});

const activation = useBackendActivation({
  ge,
  baseUrl,
  authHeader: authHeader as Ref<string | undefined>,
  selectedProjectId: ref(""),
  selectedSessionId,
  activeBackendKind,
  t,
  toErrorMessage,
  fetchHomePath: async () => {},
  bootstrapSelections: async () => {},
  fetchProviders: async () => {},
  fetchAgents: async () => {},
});

const sessionsStore = useSessions();

const sessionLifecycle = useBackendSessionLifecycle({
  activeBackendKind,
  selectedSessionId,
  activeDirectory,
  isAborting,
  t,
  toErrorMessage,
  onSessionCreated: (session) => {
    // Register the freshly created session immediately so the sidebar shows it
    // without waiting for the (sometimes delayed) session.created SSE event.
    if (session?.id) {
      sessionsStore.upsert({
        id: session.id,
        projectID: session.projectID ?? "",
        directory: session.directory ?? activeDirectory.value,
        title: session.title ?? `Session ${session.id.slice(0, 8)}`,
        slug: session.slug ?? "",
        version: "",
        time: {
          created: session.time?.created ?? Date.now() / 1000,
          updated: session.time?.updated ?? Date.now() / 1000,
        },
      });
    }
  },
});

// Track sessions from the backend so the sidebar can list/switch them.
ge.on("session.created", (payload) => {
  const info = (payload as { info?: SessionInfo })?.info;
  if (info) sessionsStore.upsert(info);
});
ge.on("session.updated", (payload) => {
  const info = (payload as { info?: SessionInfo })?.info;
  if (info) sessionsStore.upsert(info);
});
ge.on("session.deleted", (payload) => {
  const info = (payload as { info?: SessionInfo })?.info;
  if (info?.id) sessionsStore.remove(info.id);
});

ge.on("message.updated", (payload) => {
  const info = (payload as MessageUpdatedPacket).info;
  if (!info || info.role !== "assistant") return;
  if (info.time?.completed === undefined && !info.finish && !info.error) return;
  scheduleDiffRefresh(info.sessionID);
});

ge.on("file.edited", () => {
  if (selectedSessionId.value) scheduleDiffRefresh(selectedSessionId.value, 800);
  else scheduleWorkspaceDiffRefresh(800);
  // OpenSpec 面板也需要刷新(proposal/tasks/spec 文件可能被 agent 改了)
  void import("./useOpenSpec").then((m) => m.useOpenSpec().scheduleRefresh(800));
});

ge.on("session.status", (payload) => {
  const packet = payload as SessionStatusPacket;
  if (packet.status?.type !== "idle") return;
  scheduleDiffRefresh(packet.sessionID, 250);
});

// Pull the persisted session list from the backend so previously-created
// conversations appear in the sidebar (not just ones created this run).
async function refreshSessions(): Promise<void> {
  try {
    const adapter = getActiveBackendAdapter();
    if (!adapter.listSessions) return;
    const result = (await adapter.listSessions({
      directory: activeDirectory.value || undefined,
    })) as SessionInfo[] | undefined;
    if (Array.isArray(result)) {
      for (const info of result) sessionsStore.upsert(info);
    }
  } catch (error) {
    console.error("[useBackend] refreshSessions failed:", error);
  }
}

const messageSend = useBackendMessageSend({
  selectedSessionId,
  activeDirectory,
  isSending,
  agent,
  modelId,
  providerId,
  variant,
  toErrorMessage,
});

// ── SSE → Message Store binding ──────────────────────────────────────────

const msgStore = useMessages();
const acc = useDeltaAccumulator();
const sessionStatus = useSessionStatus();
const pendingDiffRefresh = new Map<string, number>();
let pendingWorkspaceDiffRefresh: number | undefined;

async function refreshWorkspaceDiffs(): Promise<FileDiff[]> {
  if (!activeDirectory.value) {
    workspaceDiffs.value = [];
    return [];
  }
  try {
    const diffs = ((await readWorkspaceDiff(activeDirectory.value)) ?? []) as FileDiff[];
    workspaceDiffs.value = diffs;
    return diffs;
  } catch (error) {
    console.error("[useBackend] refresh workspace diff failed:", error);
    workspaceDiffs.value = [];
    return [];
  }
}

function scheduleWorkspaceDiffRefresh(delayMs = 250): void {
  if (pendingWorkspaceDiffRefresh !== undefined) {
    window.clearTimeout(pendingWorkspaceDiffRefresh);
  }
  pendingWorkspaceDiffRefresh = window.setTimeout(() => {
    pendingWorkspaceDiffRefresh = undefined;
    void refreshWorkspaceDiffs();
  }, delayMs);
}

function scheduleDiffRefresh(sessionId: string, delayMs = 500): void {
  if (!sessionId) return;
  const existing = pendingDiffRefresh.get(sessionId);
  if (existing !== undefined) window.clearTimeout(existing);

  const timer = window.setTimeout(async () => {
    pendingDiffRefresh.delete(sessionId);
    let sessionDiffs: FileDiff[] = [];
    const adapter = getActiveBackendAdapter();
    if (adapter.getSessionDiff) {
      try {
        const result = await adapter.getSessionDiff({
          sessionID: sessionId,
          directory: activeDirectory.value || undefined,
        });
        sessionDiffs = normalizeFileDiffs(result);
      } catch (error) {
        console.error("[useBackend] refresh session diff failed:", error);
      }
    }
    const workspace = await refreshWorkspaceDiffs();
    msgStore.setSessionDiffs(sessionId, workspace.length > 0 ? workspace : sessionDiffs);
  }, delayMs);

  pendingDiffRefresh.set(sessionId, timer);
}

// Bind SSE scope to message store when session changes
watch(selectedSessionId, (newId) => {
  if (!newId) return;
  sessionStatus.reset();
  const scope = ge.session(selectedSessionId);
  msgStore.bindScope(scope);
  acc.listen(scope);
  sessionStatus.bindScope(scope);
  scheduleDiffRefresh(newId, 0);
});

// Sync project directory → activeDirectory
// Only use absolute paths (starting with / or drive letter like C:\)
function isAbsolutePath(p: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(p) || p.startsWith("/");
}

const project = useProject();
watch(
  () => project.state.directoryPath,
  (path) => {
    if (path && isAbsolutePath(path)) {
      activeDirectory.value = path;
      scheduleWorkspaceDiffRefresh(0);
    }
    if (path && selectedSessionId.value) {
      scheduleDiffRefresh(selectedSessionId.value, 0);
    }
  },
  { immediate: true },
);

// ── Electron: auto-connect when project directory is set ──────────────────

if (electronMode) {
  watch(
    () => project.state.directoryPath,
    (path) => {
      if (!path) return;
      if (activation.connectionState.value === "disconnected") {
        activation.startInitialization();
      }
    },
  );

  // Eagerly create a session once the connection is ready so the first
  // message doesn't pay the session-creation round-trip cost.
  watch(activation.connectionState, (state) => {
    if (state !== "ready") return;
    // Populate the sidebar with previously-persisted sessions for this dir.
    void refreshSessions();
    if (!selectedSessionId.value && activeDirectory.value) {
      sessionLifecycle.createSession(activeDirectory.value);
    }
  });
} else {
  // Browser mode: refresh sessions once connected.
  watch(activation.connectionState, (state) => {
    if (state === "ready") void refreshSessions();
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export function useBackend() {
  async function ensureSession(): Promise<string> {
    if (selectedSessionId.value) return selectedSessionId.value;
    const dir = activeDirectory.value || undefined;
    const session = await sessionLifecycle.createSession(dir);
    return session?.id ?? selectedSessionId.value;
  }

  // Begin a fresh conversation in the same window: cache the current session's
  // messages, clear the transcript, and drop the active session id so the next
  // prompt lazily creates a brand-new session. Previous sessions remain in the
  // sidebar and can be switched back to.
  function startNewSession(): void {
    const currentId = selectedSessionId.value;
    if (currentId) msgStore.saveSessionState(currentId);
    msgStore.reset();
    sessionStatus.reset();
    selectedSessionId.value = "";
  }

  async function sendPromptWithSession(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Optimistically show the user message immediately
    const tempId = msgStore.addPendingUserMessage(
      selectedSessionId.value || "pending",
      trimmed,
      agent.value,
    );

    await ensureSession();
    if (!selectedSessionId.value) {
      msgStore.removeMessage(tempId);
      return false;
    }

    const success = await messageSend.sendPrompt(trimmed);
    if (!success) msgStore.removeMessage(tempId);
    // On success, the real message arrives via SSE and auto-cleans the temp
    return success;
  }

  function setBaseUrl(url: string) {
    baseUrl.value = url;
    const kind = activeBackendKind.value;
    if (kind === "opencode") {
      storageSet(StorageKeys.auth.opencodeBaseUrl, url);
      configureOpenCodeBackend({ baseUrl: url });
    } else if (kind === "zero") {
      storageSet(StorageKeys.auth.zeroBaseUrl, url);
      configureZeroBackend({ baseUrl: url });
    }
  }

  function setAuthHeader(header: string | undefined) {
    authHeader.value = header;
    const kind = activeBackendKind.value;
    if (kind === "opencode") {
      if (header) storageSet(StorageKeys.auth.opencodeAuthorization, header);
      else storageSet(StorageKeys.auth.opencodeAuthorization, "");
      configureOpenCodeBackend({ authorization: header });
    } else if (kind === "zero") {
      if (header) storageSet(StorageKeys.auth.zeroAuthorization, header);
      else storageSet(StorageKeys.auth.zeroAuthorization, "");
      configureZeroBackend({ authorization: header });
    }
  }

  /**
   * Switch to a different backend kind. Reconfigures the new adapter with its
   * persisted URL/auth, updates the active ref, and (in Electron mode) asks
   * the main process to restart the spawned CLI with the new kind/port.
   *
   * Does NOT auto-connect — caller should invoke `reconnect()` after switch.
   */
  /**
   * Apply persisted URL/auth for a backend kind into the shared client state.
   * Factored out so switchBackend can reuse it when rolling back after a
   * failed switch.
   */
  function applyBackendConfig(kind: BackendKind): void {
    const persistedUrl = getPersistedUrlFor(kind);
    baseUrl.value = persistedUrl;
    if (kind === "opencode") {
      const persistedAuth = storageGet(StorageKeys.auth.opencodeAuthorization) ?? undefined;
      authHeader.value = persistedAuth;
      configureOpenCodeBackend({ baseUrl: persistedUrl, authorization: persistedAuth });
    } else if (kind === "zero") {
      const persistedAuth = storageGet(StorageKeys.auth.zeroAuthorization) ?? undefined;
      authHeader.value = persistedAuth;
      configureZeroBackend({ baseUrl: persistedUrl, authorization: persistedAuth });
    }

    // In Electron, ask main process to restart the CLI with the new kind.
    // cli-bridge runs as a separate process (not spawned by main), so we only
    // restart for opencode/zero.
    if (kind === "opencode" || kind === "zero") {
      try {
        const { restartAgent } = await import("../utils/electronBridge");
        await restartAgent(kind);
      } catch {
        // non-electron environment — ignore
      }
    }
  }

  function setActiveDirectory(dir: string) {
    activeDirectory.value = dir;
  }

  async function deleteSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    try {
      const adapter = getActiveBackendAdapter();
      if (adapter.deleteSession) {
        await adapter.deleteSession(sessionId, activeDirectory.value || undefined);
      }
    } catch (error) {
      console.error("[useBackend] deleteSession failed:", error);
    }
    sessionsStore.remove(sessionId);
    // If the deleted session was active, clear the transcript so the next prompt
    // lazily creates a fresh session.
    if (selectedSessionId.value === sessionId) {
      msgStore.saveSessionState(sessionId);
      msgStore.reset();
      sessionStatus.reset();
      selectedSessionId.value = "";
    }
  }

  return {
    // State
    baseUrl: readonly(baseUrl),
    authHeader: readonly(authHeader),
    activeBackendKind: readonly(activeBackendKind),
    activeDirectory: readonly(activeDirectory),
    selectedSessionId: readonly(selectedSessionId),
    connectionState: activation.connectionState,
    errorMessage: activation.errorMessage,
    initMessage: activation.initMessage,
    isSending: readonly(isSending),
    isBusy: sessionStatus.isBusy,
    isRetrying: sessionStatus.isRetrying,
    sessionStatus: sessionStatus.status,
    sessions: sessionsStore.sortedSessions,
    workspaceDiffs: readonly(workspaceDiffs),
    isElectron: electronMode,

    // Actions
    connect: activation.startInitialization,
    disconnect: activation.abortInitialization,
    reconnect: activation.reconnect,
    setBaseUrl,
    setAuthHeader,
    setActiveDirectory,
    switchBackend,

    // Session
    createSession: sessionLifecycle.createSession,
    selectSession: sessionLifecycle.selectSession,
    deleteSession,
    abortSession: sessionLifecycle.abortSession,
    startNewSession,

    // Messages (with auto session creation)
    sendPrompt: sendPromptWithSession,

    // Global events (for SSE subscription)
    globalEvents: ge,
  };
}
