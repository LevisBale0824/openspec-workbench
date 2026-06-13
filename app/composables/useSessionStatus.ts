// ---------------------------------------------------------------------------
// Session Status Store
// ---------------------------------------------------------------------------
// Tracks the active session's busy / idle / retry state by listening to the
// `session.status` SSE event. The per-message `streaming` flag is unreliable
// for surfacing "agent still working" while background subtasks run — the
// agent may emit text (clearing the streaming indicator) yet keep executing.
// This store gives the UI a single source of truth for ongoing activity.
// ---------------------------------------------------------------------------

import { computed, ref } from "vue";
import type { SessionStatusInfo } from "../types/sse";
import type { SessionScope } from "./useGlobalEvents";

const status = ref<SessionStatusInfo>({ type: "idle" });
const unsubs: Array<() => void> = [];

function bindScope(scope: SessionScope) {
  for (const unsub of unsubs) unsub();
  unsubs.length = 0;

  unsubs.push(
    scope.on("session.status", (packet) => {
      if (!packet || typeof packet !== "object") return;
      const p = packet as { status?: SessionStatusInfo };
      if (p.status && typeof p.status === "object") {
        status.value = p.status;
      }
    }),
  );
}

function reset() {
  status.value = { type: "idle" };
}

export function useSessionStatus() {
  return {
    status,
    isBusy: computed(() => status.value.type === "busy"),
    isRetrying: computed(() => status.value.type === "retry"),
    bindScope,
    reset,
  };
}
