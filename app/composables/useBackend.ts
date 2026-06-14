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
  getPersistedUrlFor,
  configureOpenCodeBackend,
  configureZeroBackend,
  setActiveBackendKind,
} from "../backends/registry";
import { StorageKeys, storageGet, storageSet } from "../utils/storageKeys";
import { i18n } from "../i18n";
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

// Initialise baseUrl + authHeader from the *persisted active kind* so they
// match the adapter that `getActiveBackendAdapter()` will return. Previously
// this hardcoded opencode's URL/auth, which left the SSE client pointed at
// :13284 even when the user had last selected zero (:13286) — manifesting as
// silent connection failures and stray TIME_WAIT sockets on the wrong port.
const initialBackendKind = getActiveBackendKind();
const baseUrl = ref(getPersistedUrlFor(initialBackendKind));
const authHeader = ref(
  initialBackendKind === "zero"
    ? (storageGet(StorageKeys.auth.zeroAuthorization) ?? undefined)
    : (storageGet(StorageKeys.auth.opencodeAuthorization) ?? undefined),
);
const activeBackendKind = ref<BackendKind>(initialBackendKind);

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
  // The main process starts the agent server in app.whenReady() before the
  // window is created, so by the time this module initializes the server is
  // already listening. Connect immediately rather than waiting for the user
  // to open a project — this makes the sidebar status accurate on launch and
  // avoids a confusing "disconnected" state on a healthy backend.
  activation.startInitialization();

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
  }

  /**
   * Restart the current agent's server (Electron only). Used to recover from
   * an externally-killed daemon (e.g. user killed opencode.exe in Task Manager).
   * Calls the main process's setAgentConfig IPC, which calls restartServer()
   * internally and returns the new server status.
   *
   * Unlike switchBackend, this does NOT change the active kind — it just
   * respawns the same CLI. On failure, writes to errorMessage so the UI can
   * surface the problem.
   */
  async function restartCurrentAgent(): Promise<boolean> {
    if (!electronMode) return false;
    const kind = activeBackendKind.value;
    if (kind !== "opencode" && kind !== "zero") return false;

    activation.errorMessage.value = "";
    try {
      const { restartAgent } = await import("../utils/electronBridge");
      const result = await restartAgent(kind);
      if (!result || !result.status.running) {
        activation.errorMessage.value = i18n.global.t("status.startFailed", {
          agent: kind,
          reason: i18n.global.t("status.serverDown"),
        });
        return false;
      }
      // Server is back up — ask activation flow to reconnect SSE/REST.
      void activation.reconnect();
      return true;
    } catch (e) {
      console.warn(`[useBackend] restart ${kind} failed:`, e);
      activation.errorMessage.value = i18n.global.t("status.startFailed", {
        agent: kind,
        reason: toErrorMessage(e),
      });
      return false;
    }
  }

  async function switchBackend(kind: BackendKind): Promise<void> {
    if (kind === activeBackendKind.value) return;
    const previousKind = activeBackendKind.value;

    activeBackendKind.value = kind;
    setActiveBackendKind(kind);
    applyBackendConfig(kind);
    activation.errorMessage.value = "";

    // Clear session/message state. The previous agent's session IDs and
    // messages belong to that agent's daemon; mixing them with the new agent
    // would show stale or invalid data. switchBackend auto-reconnects after
    // both successful switch and successful rollback.
    if (selectedSessionId.value) {
      msgStore.saveSessionState(selectedSessionId.value);
    }
    msgStore.reset();
    selectedSessionId.value = "";

    // In Electron, ask main process to restart the CLI with the new kind.
    // cli-bridge runs as a separate process (not spawned by main), so we only
    // restart for opencode/zero.
    if (kind === "opencode" || kind === "zero") {
      try {
        const { restartAgent } = await import("../utils/electronBridge");
        const result = await restartAgent(kind);
        // If the main process reports the server didn't come up (e.g. CLI
        // binary missing), roll back to the previous kind so the user is
        // not stuck on a dead backend.
        if (!result || !result.status.running) {
          throw new Error(i18n.global.t("status.serverDown"));
        }
        // Server is up — reconnect SSE/REST to the new backend.
        void activation.reconnect();
      } catch (e) {
        console.warn(`[useBackend] switch to ${kind} failed, rolling back:`, e);
        activeBackendKind.value = previousKind;
        setActiveBackendKind(previousKind);
        applyBackendConfig(previousKind);
        // Restore the previous backend's server process — it was stopped when
        // we attempted to start the new one. Only opencode/zero have a main-
        // process-managed lifecycle; cli-bridge runs externally.
        let rollbackOk = true;
        if (previousKind === "opencode" || previousKind === "zero") {
          try {
            const { restartAgent } = await import("../utils/electronBridge");
            const result = await restartAgent(previousKind);
            if (!result || !result.status.running) rollbackOk = false;
          } catch {
            // best-effort; previous state may have been a misconfigured backend too
            rollbackOk = false;
          }
        }
        if (rollbackOk) {
          // Previous server restored — reconnect to it so the UI reflects the
          // recovered state instead of staying "disconnected".
          void activation.reconnect();
        } else {
          // Only surface the original failure if rollback ALSO failed to
          // restore a working server. If rollback succeeded the UI is already
          // back on a healthy backend, so showing "zero failed" would be
          // misleading noise.
          activation.errorMessage.value = i18n.global.t("status.startFailed", {
            agent: kind,
            reason: toErrorMessage(e),
          });
        }
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
    restartCurrentAgent,

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
