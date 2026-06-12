// ---------------------------------------------------------------------------
// Global SSE Event Bus
// ---------------------------------------------------------------------------
// Manages the SSE connection and dispatches typed events to listeners.
// Supports session-scoped filtering so components only see relevant events.
// Simplified for Phase 2 — direct SSE transport (SharedWorker in Phase 3).
// Ported from opencode-visualizer-cn/app/composables/useGlobalEvents.ts
// ---------------------------------------------------------------------------

import { type Ref, watch } from "vue";
import type { GlobalEventMap, SsePacket } from "../types/sse";
import { createSseConnection } from "../utils/sseConnection";
import { TypedEmitter } from "../utils/eventEmitter";

type EventKey = keyof GlobalEventMap;
type ConnectOptions = { failFast?: boolean; timeoutMs?: number };

type CredentialsBinding = {
  baseUrl: Ref<string>;
  authHeader: Ref<string | undefined>;
};

export type SessionScope = {
  on<K extends EventKey>(
    event: K,
    listener: (payload: GlobalEventMap[K]) => void,
  ): () => void;
  on(event: string, listener: (payload: unknown) => void): () => void;
  dispose(): void;
};

export type MainSessionScope = SessionScope;

// ── Known event types ─────────────────────────────────────────────────────

const KNOWN_EVENT_TYPES = new Set<EventKey>([
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "message.part.removed",
  "session.created",
  "session.updated",
  "session.deleted",
  "session.diff",
  "session.error",
  "session.status",
  "session.compacted",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
  "todo.updated",
  "pty.created",
  "pty.updated",
  "pty.exited",
  "pty.deleted",
  "worktree.ready",
  "worktree.failed",
  "project.updated",
  "vcs.branch.updated",
  "file.edited",
  "file.watcher.updated",
  "lsp.updated",
  "lsp.client.diagnostics",
  "command.executed",
  "installation.updated",
  "installation.update-available",
  "mcp.tools.changed",
  "connection.open",
  "connection.error",
  "connection.reconnected",
]);

function isKnownEventType(value: string): value is EventKey {
  return KNOWN_EVENT_TYPES.has(value as EventKey);
}

// ── Session ID extraction ─────────────────────────────────────────────────

function extractSessionId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.sessionID === "string") return record.sessionID;
  if (typeof record.sessionId === "string") return record.sessionId;

  const info =
    record.info && typeof record.info === "object"
      ? (record.info as Record<string, unknown>)
      : undefined;
  if (typeof info?.sessionID === "string") return info.sessionID;
  if (typeof info?.sessionId === "string") return info.sessionId;

  const part =
    record.part && typeof record.part === "object"
      ? (record.part as Record<string, unknown>)
      : undefined;
  if (typeof part?.sessionID === "string") return part.sessionID;

  return undefined;
}

// ── URL normalization ─────────────────────────────────────────────────────

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

// ── Main composable ───────────────────────────────────────────────────────

export function useGlobalEvents(credentials: CredentialsBinding) {
  const emitter = new TypedEmitter<GlobalEventMap>();

  let connected = false;
  let openResolver: ((value: void) => void) | null = null;
  let openRejector: ((reason: Error) => void) | null = null;

  function routePacket(packet: SsePacket) {
    const type = packet.payload.type;
    if (!isKnownEventType(type)) return;
    emitter.emit(
      type,
      packet.payload.properties as GlobalEventMap[typeof type],
    );
  }

  const connection = createSseConnection({
    onPacket: routePacket,
    onOpen(isReconnect) {
      connected = true;
      emitter.emit("connection.open", {});
      if (isReconnect) emitter.emit("connection.reconnected", {});
      if (openResolver) {
        openResolver();
        openResolver = null;
        openRejector = null;
      }
    },
    onError(message, statusCode) {
      connected = false;
      emitter.emit("connection.error", { message, statusCode });
      if (openRejector) {
        openRejector(new Error(message));
        openResolver = null;
        openRejector = null;
      }
    },
  });

  function waitForOpen(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (connected || connection.isConnected()) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        openResolver = null;
        openRejector = null;
        reject(new Error("SSE connection timed out"));
      }, timeoutMs);
      openResolver = () => {
        clearTimeout(timer);
        resolve();
      };
      openRejector = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };
    });
  }

  // ── Credential sync ───────────────────────────────────────────────────

  let requested = false;
  let lastKey = "";

  const stopCredentialSync = watch(
    [() => credentials.baseUrl.value, () => credentials.authHeader.value],
    ([baseUrl, authHeader]) => {
      if (!requested) return;
      const normalized = normalizeBaseUrl(baseUrl);
      if (!normalized) {
        connection.disconnect();
        lastKey = "";
        return;
      }
      const nextKey = `${normalized}\u0000${authHeader ?? ""}`;
      if (nextKey === lastKey) return;
      lastKey = nextKey;
      connection.connect({ baseUrl: normalized, authorization: authHeader });
    },
  );

  const stopAutoDisconnect = watch(
    () => credentials.baseUrl.value,
    (baseUrl) => {
      if (baseUrl.trim()) return;
      disconnect();
    },
  );

  // ── Public API ────────────────────────────────────────────────────────

  async function connect(options: ConnectOptions = {}) {
    const baseUrl = normalizeBaseUrl(credentials.baseUrl.value);
    if (!baseUrl) throw new Error("SSE base URL is empty");
    requested = true;
    lastKey = `${baseUrl}\u0000${credentials.authHeader.value ?? ""}`;
    connection.connect({ baseUrl, authorization: credentials.authHeader.value });
    if (options.failFast) {
      await waitForOpen(options.timeoutMs ?? 5000);
    }
  }

  function disconnect() {
    requested = false;
    lastKey = "";
    connection.disconnect();
  }

  function on<K extends EventKey>(
    event: K,
    listener: (payload: GlobalEventMap[K]) => void,
  ): () => void;
  function on(
    event: string,
    listener: (payload: unknown) => void,
  ): () => void;
  function on(
    event: string,
    listener: (payload: unknown) => void,
  ): () => void {
    if (!isKnownEventType(event)) return () => {};
    return emitter.on(event, listener);
  }

  function session(
    selectedSessionId: Ref<string>,
    _parents: Readonly<Record<string, string | undefined>> = {},
  ): SessionScope {
    const disposers = new Set<() => void>();

    function scopedOn<K extends EventKey>(
      event: K,
      listener: (payload: GlobalEventMap[K]) => void,
    ): () => void;
    function scopedOn(
      event: string,
      listener: (payload: unknown) => void,
    ): () => void;
    function scopedOn(
      event: string,
      listener: (payload: unknown) => void,
    ): () => void {
      if (!isKnownEventType(event)) return () => {};
      const off = on(event, (payload) => {
        const sessionId = extractSessionId(payload);
        // Allow events with no session ID (global) or matching session
        if (!sessionId || sessionId === selectedSessionId.value) {
          listener(payload);
        }
      });
      disposers.add(off);
      return () => {
        off();
        disposers.delete(off);
      };
    }

    function dispose() {
      for (const off of disposers) off();
      disposers.clear();
    }

    return { on: scopedOn, dispose };
  }

  function mainSession(
    selectedSessionId: Ref<string>,
  ): MainSessionScope {
    const disposers = new Set<() => void>();

    function scopedOn<K extends EventKey>(
      event: K,
      listener: (payload: GlobalEventMap[K]) => void,
    ): () => void;
    function scopedOn(
      event: string,
      listener: (payload: unknown) => void,
    ): () => void;
    function scopedOn(
      event: string,
      listener: (payload: unknown) => void,
    ): () => void {
      if (!isKnownEventType(event)) return () => {};
      const off = on(event, (payload) => {
        const sessionId = extractSessionId(payload);
        if (!sessionId || sessionId === selectedSessionId.value) {
          listener(payload);
        }
      });
      disposers.add(off);
      return () => {
        off();
        disposers.delete(off);
      };
    }

    function dispose() {
      for (const off of disposers) off();
      disposers.clear();
    }

    return { on: scopedOn, dispose };
  }

  function dispose() {
    stopCredentialSync();
    stopAutoDisconnect();
    disconnect();
  }

  return {
    on,
    connect,
    disconnect,
    session,
    mainSession,
    dispose,
  };
}
