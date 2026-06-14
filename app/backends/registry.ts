// ---------------------------------------------------------------------------
// Backend Adapter Registry
// ---------------------------------------------------------------------------
// Module-level singleton registry that manages the active backend adapter.
// UI code calls getActiveBackendAdapter() to access the current backend.
// Ported from opencode-visualizer-cn/app/backends/registry.ts
// ---------------------------------------------------------------------------

import { createOpenCodeAdapter } from "./openCodeAdapter";
import { createZeroAdapter } from "./zeroAdapter";
import type { BackendAdapter, BackendKind } from "./types";
import { StorageKeys, storageGet } from "../utils/storageKeys";

// ── Default URLs ──────────────────────────────────────────────────────────

const DEFAULT_OPENCODE_URL = "http://localhost:13284";
const DEFAULT_ZERO_URL = "http://localhost:13286";
const DEFAULT_CLI_BRIDGE_URL = "http://localhost:13285";

// ── Adapter instances ────────────────────────────────────────────────────

let adapters: Partial<Record<BackendKind, BackendAdapter>> = {};

// Active backend kind is intentionally NOT persisted across launches. Every
// app boot starts as "opencode" (the safe default — matches the main process
// spawn). If the user previously switched to an agent whose CLI isn't
// installed, persisting that choice would brick every subsequent launch.
// Switching during a session updates this in-memory value only.
let activeBackendKind: BackendKind = "opencode";

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
  for (const listener of listeners) listener(kind);
}

export function onActiveBackendKindChange(listener: (kind: BackendKind) => void) {
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

export function configureOpenCodeBackend(options: { baseUrl?: string; authorization?: string }) {
  getBackendAdapter("opencode").configure?.(options);
}

export function configureZeroBackend(options: { baseUrl?: string; authorization?: string }) {
  getBackendAdapter("zero").configure?.(options);
}

export function getPersistedOpenCodeUrl(): string {
  return storageGet(StorageKeys.auth.opencodeBaseUrl) ?? DEFAULT_OPENCODE_URL;
}

export function getPersistedZeroUrl(): string {
  return storageGet(StorageKeys.auth.zeroBaseUrl) ?? DEFAULT_ZERO_URL;
}

export function getPersistedCliBridgeUrl(): string {
  return storageGet(StorageKeys.auth.cliBridgeUrl) ?? DEFAULT_CLI_BRIDGE_URL;
}

/** Returns the persisted baseURL for the given backend kind. */
export function getPersistedUrlFor(kind: BackendKind): string {
  switch (kind) {
    case "opencode":
      return getPersistedOpenCodeUrl();
    case "zero":
      return getPersistedZeroUrl();
    case "cli-bridge":
      return getPersistedCliBridgeUrl();
  }
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
  if (!adapters["zero"]) {
    const z = createZeroAdapter();
    const persistedUrl = getPersistedZeroUrl();
    const persistedAuth = storageGet(StorageKeys.auth.zeroAuthorization);
    z.configure?.({
      baseUrl: persistedUrl,
      authorization: persistedAuth ?? undefined,
    });
    adapters = { ...adapters, zero: z };
  }
}

// Initialise on import
ensureAdapters();
