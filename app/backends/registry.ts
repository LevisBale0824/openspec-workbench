// ---------------------------------------------------------------------------
// Backend Adapter Registry
// ---------------------------------------------------------------------------
// Module-level singleton registry that manages the active backend adapter.
// UI code calls getActiveBackendAdapter() to access the current backend.
// Ported from opencode-visualizer-cn/app/backends/registry.ts
// ---------------------------------------------------------------------------

import { createOpenCodeAdapter } from "./openCodeAdapter";
import type { BackendAdapter, BackendKind } from "./types";
import { StorageKeys, storageGet, storageSet } from "../utils/storageKeys";

// ── Default URLs ──────────────────────────────────────────────────────────

const DEFAULT_OPENCODE_URL = "http://localhost:13284";
const DEFAULT_CLI_BRIDGE_URL = "http://localhost:13285";

// ── Adapter instances ────────────────────────────────────────────────────

let adapters: Partial<Record<BackendKind, BackendAdapter>> = {};

let activeBackendKind: BackendKind =
  (storageGet(StorageKeys.auth.activeBackend) as BackendKind) ?? "opencode";

const listeners = new Set<(kind: BackendKind) => void>();

// ── Public API ────────────────────────────────────────────────────────────

export function getActiveBackendKind(): BackendKind {
  return activeBackendKind;
}

export function setActiveBackendKind(kind: BackendKind) {
  if (!adapters[kind]) {
    throw new Error(`Backend adapter is not registered: ${kind}`);
  }
  activeBackendKind = kind;
  storageSet(StorageKeys.auth.activeBackend, kind);
  for (const listener of listeners) listener(kind);
}

export function onActiveBackendKindChange(
  listener: (kind: BackendKind) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerAdapter(adapter: BackendAdapter) {
  adapters = { ...adapters, [adapter.kind]: adapter };
}

export function getBackendAdapter(kind: BackendKind): BackendAdapter {
  const adapter = adapters[kind];
  if (!adapter) {
    throw new Error(`Backend adapter is not registered: ${kind}`);
  }
  return adapter;
}

export function getActiveBackendAdapter(): BackendAdapter {
  return getBackendAdapter(activeBackendKind);
}

// ── Configure helpers ────────────────────────────────────────────────────

export function configureOpenCodeBackend(options: {
  baseUrl?: string;
  authorization?: string;
}) {
  getBackendAdapter("opencode").configure?.(options);
}

export function getPersistedOpenCodeUrl(): string {
  return storageGet(StorageKeys.auth.opencodeBaseUrl) ?? DEFAULT_OPENCODE_URL;
}

export function getPersistedCliBridgeUrl(): string {
  return (
    storageGet(StorageKeys.auth.cliBridgeUrl) ?? DEFAULT_CLI_BRIDGE_URL
  );
}

// ── Lazy init ────────────────────────────────────────────────────────────

function ensureAdapters() {
  if (!adapters["opencode"]) {
    const oc = createOpenCodeAdapter();
    const persistedUrl = getPersistedOpenCodeUrl();
    const persistedAuth = storageGet(StorageKeys.auth.opencodeAuthorization);
    oc.configure?.({
      baseUrl: persistedUrl,
      authorization: persistedAuth ?? undefined,
    });
    adapters = { ...adapters, opencode: oc };
  }
}

// Initialise on import
ensureAdapters();
