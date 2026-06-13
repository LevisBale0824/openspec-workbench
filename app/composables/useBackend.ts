// ---------------------------------------------------------------------------
// Backend Orchestrator — top-level composable
// ---------------------------------------------------------------------------
// Wires together useGlobalEvents, useBackendActivation, useBackendSessionLifecycle,
// and useBackendMessageSend into a single reactive surface for the UI.
// ---------------------------------------------------------------------------

import { ref, readonly, watch, type Ref } from "vue";
import { useGlobalEvents } from "./useGlobalEvents";
import { useBackendActivation, type ConnectionState } from "./useBackendActivation";
import { useBackendSessionLifecycle } from "./useBackendSessionLifecycle";
import { useBackendMessageSend } from "./useBackendMessageSend";
import { useMessages } from "./useMessages";
import { useDeltaAccumulator } from "./useDeltaAccumulator";
import { useSessionStatus } from "./useSessionStatus";
import { useSessions } from "./useSessions";
import { useProject } from "./useProject";
import { isElectron as detectElectron } from "../utils/electronBridge";
import {
  getActiveBackendKind,
  getActiveBackendAdapter,
  getPersistedOpenCodeUrl,
  configureOpenCodeBackend,
} from "../backends/registry";
import { StorageKeys, storageGet, storageSet } from "../utils/storageKeys";
import type { BackendKind } from "../backends/types";
import type { SessionInfo } from "../types/sse";

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

function t(key: string): string {
  return key;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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

// Bind SSE scope to message store when session changes
watch(selectedSessionId, (newId) => {
  if (!newId) return;
  sessionStatus.reset();
  const scope = ge.session(selectedSessionId);
  msgStore.bindScope(scope);
  acc.listen(scope);
  sessionStatus.bindScope(scope);
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
    if (path && isAbsolutePath(path)) activeDirectory.value = path;
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
    if (activeBackendKind.value === "opencode") {
      storageSet(StorageKeys.auth.opencodeBaseUrl, url);
      configureOpenCodeBackend({ baseUrl: url });
    }
  }

  function setAuthHeader(header: string | undefined) {
    authHeader.value = header;
    if (activeBackendKind.value === "opencode") {
      if (header) storageSet(StorageKeys.auth.opencodeAuthorization, header);
      else storageSet(StorageKeys.auth.opencodeAuthorization, "");
      configureOpenCodeBackend({ authorization: header });
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
    isElectron: electronMode,

    // Actions
    connect: activation.startInitialization,
    disconnect: activation.abortInitialization,
    reconnect: activation.reconnect,
    setBaseUrl,
    setAuthHeader,
    setActiveDirectory,

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
