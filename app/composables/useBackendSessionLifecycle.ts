// ---------------------------------------------------------------------------
// Backend Session Lifecycle
// ---------------------------------------------------------------------------
// Manages session creation, selection, and abort for both OpenCode and
// CLI Bridge backends.
// ---------------------------------------------------------------------------

import type { Ref } from "vue";
import type { BackendKind } from "../backends/types";
import { getActiveBackendAdapter } from "../backends/registry";
import type { BackendSessionInfo } from "../types/backend-domain";
import { useMessages } from "./useMessages";

export type SessionLifecycleOptions = {
  activeBackendKind: Ref<BackendKind>;
  selectedSessionId: Ref<string>;
  activeDirectory: Ref<string>;
  isAborting: Ref<boolean>;
  t: (key: string) => string;
  toErrorMessage: (error: unknown) => string;
  onSessionCreated?: (session: BackendSessionInfo) => void;
  onSessionError?: (message: string) => void;
};

export function useBackendSessionLifecycle(
  options: SessionLifecycleOptions,
) {
  const msgStore = useMessages();

  async function createSession(directory?: string): Promise<BackendSessionInfo | undefined> {
    try {
      const dir = directory ?? options.activeDirectory.value.trim();
      if (!dir) throw new Error(options.t("errors.sessionCreateEmptyDirectory"));

      const adapter = getActiveBackendAdapter();
      const result = await adapter.createSession(dir);
      const session = result as BackendSessionInfo | undefined;

      if (session?.id) {
        options.selectedSessionId.value = session.id;
        options.onSessionCreated?.(session);
      }
      return session;
    } catch (error) {
      const message = options.toErrorMessage(error);
      options.onSessionError?.(message);
      return undefined;
    }
  }

  async function selectSession(sessionId: string) {
    if (!sessionId) return;

    // Save current session state to cache
    const currentId = options.selectedSessionId.value;
    if (currentId && currentId !== sessionId) {
      msgStore.saveSessionState(currentId);
    }

    // Try loading from cache first
    if (msgStore.tryLoadFromCache(sessionId)) {
      options.selectedSessionId.value = sessionId;
      return;
    }

    // Load from backend
    try {
      const adapter = getActiveBackendAdapter();
      options.selectedSessionId.value = sessionId;

      if (adapter.listSessionMessages) {
        const messages = await adapter.listSessionMessages(sessionId, {
          directory: options.activeDirectory.value || undefined,
        });
        if (Array.isArray(messages)) {
          msgStore.reset();
          msgStore.loadHistory(messages);
        }
      }
    } catch (error) {
      console.error("[SessionLifecycle] Failed to load session:", error);
    }
  }

  async function abortSession() {
    const sessionId = options.selectedSessionId.value;
    if (!sessionId || options.isAborting.value) return;

    options.isAborting.value = true;
    try {
      const adapter = getActiveBackendAdapter();
      if (adapter.abortSession) {
        await adapter.abortSession(sessionId, options.activeDirectory.value || undefined);
      }
    } catch (error) {
      console.error("[SessionLifecycle] Abort failed:", error);
    } finally {
      options.isAborting.value = false;
    }
  }

  return {
    createSession,
    selectSession,
    abortSession,
  };
}
