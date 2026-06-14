// ---------------------------------------------------------------------------
// Backend Activation State Machine
// ---------------------------------------------------------------------------
// Manages the backend connection lifecycle: connecting → bootstrapping → ready.
// Simplified for OpenCode + CLI Bridge (no Codex).
// ---------------------------------------------------------------------------

import { ref, type Ref } from "vue";
import type { BackendKind } from "../backends/types";
import { setActiveBackendKind } from "../backends/registry";

export type ConnectionState = "disconnected" | "connecting" | "bootstrapping" | "ready" | "error";

export type ActivationState = {
  connectionState: Ref<ConnectionState>;
  initMessage: Ref<string>;
  errorMessage: Ref<string>;
  activeDirectory: Ref<string>;
  startInitialization: () => Promise<void>;
  abortInitialization: () => void;
  reconnect: () => Promise<void>;
};

export function useBackendActivation(params: {
  ge: {
    connect: (options: { failFast: boolean; timeoutMs: number }) => Promise<void>;
    disconnect: () => void;
  };
  baseUrl: Ref<string>;
  authHeader: Ref<string | undefined>;
  selectedProjectId: Ref<string>;
  selectedSessionId: Ref<string>;
  activeBackendKind: Ref<BackendKind>;
  t: (key: string) => string;
  toErrorMessage: (error: unknown) => string;
  fetchHomePath: () => Promise<void>;
  bootstrapSelections: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  fetchAgents: () => Promise<void>;
}): ActivationState {
  const connectionState = ref<ConnectionState>("disconnected");
  const initMessage = ref("");
  const errorMessage = ref("");
  const activeDirectory = ref("");
  const initializationInFlight = ref(false);

  async function activateOpenCode() {
    params.activeBackendKind.value = "opencode";
    setActiveBackendKind("opencode");

    connectionState.value = "connecting";
    initMessage.value = params.t("status.connecting");
    errorMessage.value = "";

    try {
      await params.ge.connect({ failFast: true, timeoutMs: 10000 });

      connectionState.value = "bootstrapping";
      initMessage.value = params.t("status.loadingProjects");

      await params.fetchHomePath();
      await params.bootstrapSelections();
      await Promise.all([params.fetchProviders(), params.fetchAgents()]);

      connectionState.value = "ready";
      initMessage.value = "";
    } catch (error) {
      params.ge.disconnect();
      const message = params.toErrorMessage(error);
      connectionState.value = "error";
      errorMessage.value = message;
    } finally {
      initializationInFlight.value = false;
    }
  }

  async function activateCliBridge() {
    params.activeBackendKind.value = "cli-bridge";
    setActiveBackendKind("cli-bridge");

    connectionState.value = "connecting";
    initMessage.value = params.t("status.connecting");
    errorMessage.value = "";

    try {
      // CLI Bridge uses SSE connection with same pattern
      await params.ge.connect({ failFast: true, timeoutMs: 10000 });

      connectionState.value = "bootstrapping";
      initMessage.value = params.t("status.loadingProjects");

      await params.fetchHomePath();
      await params.bootstrapSelections();

      connectionState.value = "ready";
      initMessage.value = "";
    } catch (error) {
      params.ge.disconnect();
      const message = params.toErrorMessage(error);
      connectionState.value = "error";
      errorMessage.value = message;
    } finally {
      initializationInFlight.value = false;
    }
  }

  // Zero server exposes the same REST/SSE API as opencode, so the activation
  // flow is identical (including providers/agents bootstrap).
  async function activateZero() {
    params.activeBackendKind.value = "zero";
    setActiveBackendKind("zero");

    connectionState.value = "connecting";
    initMessage.value = params.t("status.connecting");
    errorMessage.value = "";

    try {
      await params.ge.connect({ failFast: true, timeoutMs: 10000 });

      connectionState.value = "bootstrapping";
      initMessage.value = params.t("status.loadingProjects");

      await params.fetchHomePath();
      await params.bootstrapSelections();
      await Promise.all([params.fetchProviders(), params.fetchAgents()]);

      connectionState.value = "ready";
      initMessage.value = "";
    } catch (error) {
      params.ge.disconnect();
      const message = params.toErrorMessage(error);
      connectionState.value = "error";
      errorMessage.value = message;
    } finally {
      initializationInFlight.value = false;
    }
  }

  async function startInitialization() {
    if (initializationInFlight.value) return;
    initializationInFlight.value = true;

    const kind = params.activeBackendKind.value;
    if (kind === "opencode") {
      await activateOpenCode();
    } else if (kind === "zero") {
      await activateZero();
    } else {
      await activateCliBridge();
    }
  }

  function abortInitialization() {
    params.ge.disconnect();
    initializationInFlight.value = false;
    connectionState.value = "disconnected";
    errorMessage.value = "";
  }

  async function reconnect() {
    if (connectionState.value === "ready") return;
    await startInitialization();
  }

  return {
    connectionState,
    initMessage,
    errorMessage,
    activeDirectory,
    startInitialization,
    abortInitialization,
    reconnect,
  };
}
