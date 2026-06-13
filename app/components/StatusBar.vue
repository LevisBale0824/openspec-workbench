<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useBackend } from "../composables/useBackend";

const { t } = useI18n();
const backend = useBackend();

const statusDot: Record<string, string> = {
  disconnected: "bg-surface-600",
  connecting: "bg-accent-amber animate-pulse",
  bootstrapping: "bg-accent-amber animate-pulse",
  ready: "bg-accent-emerald",
  error: "bg-accent-rose",
};

const statusText: Record<string, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  bootstrapping: "Loading...",
  ready: "Connected",
  error: "Error",
};
</script>

<template>
  <footer class="h-6 flex items-center justify-between px-3 bg-surface-900 border-t border-surface-800 text-[10px] select-none">
    <div class="flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full" :class="statusDot[backend.connectionState.value] ?? 'bg-surface-600'" />
      <span :class="backend.connectionState.value === 'ready' ? 'text-accent-emerald' : 'text-surface-500'">
        {{ backend.isElectron ? "Electron" : "Browser" }} · {{ statusText[backend.connectionState.value] ?? "Unknown" }}
      </span>
      <span v-if="backend.activeDirectory.value" class="text-surface-600">
        · {{ backend.activeDirectory.value.split(/[/\\]/).pop() }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span v-if="backend.isSending.value" class="text-accent-amber">Sending...</span>
      <span v-else-if="backend.isBusy.value" class="flex items-center gap-1 text-accent-emerald">
        <svg class="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        Agent 运行中…
      </span>
      <span class="text-surface-600">{{ t("app.title") }}</span>
    </div>
  </footer>
</template>
