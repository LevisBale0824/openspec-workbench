// ---------------------------------------------------------------------------
// Vue Plugin Interface
// ---------------------------------------------------------------------------
// Defines the contract for OpenSpec plugins that extend the application.
// ---------------------------------------------------------------------------

import type { App, Plugin } from "vue";
import type { Router } from "vue-router";

export type OpenSpecPluginContext = {
  app: App;
  router: Router;
};

export type OpenSpecPlugin = Plugin & {
  name: string;
  description?: string;
  enabled?: boolean;
  install(app: App, ...options: unknown[]): void;
  activate?(ctx: OpenSpecPluginContext): void;
  deactivate?(): void;
};
