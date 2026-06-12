// ---------------------------------------------------------------------------
// Backend Domain Type Definitions
// ---------------------------------------------------------------------------
// Domain types shared between the frontend and backend adapters.
// Ported from opencode-visualizer-cn/app/types/backend-domain.ts
// ---------------------------------------------------------------------------

// ── Session ───────────────────────────────────────────────────────────────

export type BackendSessionInfo = {
  id: string;
  projectID?: string;
  projectId?: string;
  parentID?: string;
  title?: string;
  slug?: string;
  status?: "busy" | "idle" | "retry";
  directory?: string;
  time?: {
    created?: number;
    updated?: number;
    archived?: number;
    pinned?: number;
  };
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
};

// ── Worktree ──────────────────────────────────────────────────────────────

export type BackendWorktreeInfo = {
  name: string;
  branch: string;
  directory: string;
};

// ── Provider / Model ──────────────────────────────────────────────────────

export type BackendProviderModel = {
  id: string;
  name?: string;
  providerID?: string;
  family?: string;
  status?: string;
  variants?: Record<string, unknown>;
  limit?: {
    context?: number;
    input?: number;
    output?: number;
  };
  capabilities?: {
    attachment?: boolean;
    reasoning?: boolean;
    toolcall?: boolean;
  };
};

export type BackendProviderInfo = {
  id: string;
  name?: string;
  source?: string;
  key?: string;
  models?: Record<string, BackendProviderModel>;
};

export type BackendProviderResponse = {
  all?: BackendProviderInfo[];
  default?: Record<string, string>;
  connected?: string[];
};

export type BackendProviderConfigState = {
  enabled_providers?: string[];
  disabled_providers?: string[];
  provider?: Record<string, unknown>;
  model_providers?: Record<string, unknown>;
  model_provider?: string;
  model?: string;
};
