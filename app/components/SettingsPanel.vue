<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useBackend } from "../composables/useBackend";
import { StorageKeys, storageSet } from "../utils/storageKeys";
import type { BackendKind } from "../backends/types";

const { t, locale } = useI18n();
const backend = useBackend();

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

// ── Language ──────────────────────────────────────────────────────────

const languages = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "中文" },
];

const selectedLang = ref(locale.value);

function changeLocale(lang: string) {
  selectedLang.value = lang;
  locale.value = lang;
  storageSet(StorageKeys.ui.locale, lang);
}

// ── Agent selection ───────────────────────────────────────────────────

const agentOptions: Array<{ kind: BackendKind; labelKey: string }> = [
  { kind: "opencode", labelKey: "settings.opencode" },
  { kind: "zero", labelKey: "settings.zero" },
];

const switching = ref(false);

async function selectAgent(kind: BackendKind) {
  if (kind === backend.activeBackendKind.value || switching.value) return;
  switching.value = true;
  try {
    backend.disconnect();
    await backend.switchBackend(kind);
    urlInput.value = backend.baseUrl.value;
    authInput.value = backend.authHeader.value ?? "";
  } finally {
    switching.value = false;
  }
}

// ── Backend URL ───────────────────────────────────────────────────────

const urlInput = ref(backend.baseUrl.value);
const authInput = ref(backend.authHeader.value ?? "");

const urlPlaceholder = computed(() => {
  switch (backend.activeBackendKind.value) {
    case "zero":
      return "http://localhost:13286";
    case "cli-bridge":
      return "http://localhost:13285";
    default:
      return "http://localhost:13284";
  }
});

watch(
  () => backend.baseUrl.value,
  (v) => {
    urlInput.value = v;
  },
);

function applyUrl() {
  backend.setBaseUrl(urlInput.value.trim());
}

function applyAuth() {
  backend.setAuthHeader(authInput.value.trim() || undefined);
}

// ── Connection ────────────────────────────────────────────────────────

const restarting = ref(false);

async function restartAgent() {
  if (restarting.value) return;
  restarting.value = true;
  try {
    await backend.restartCurrentAgent();
  } finally {
    restarting.value = false;
  }
}

const statusColor: Record<string, string> = {
  disconnected: "bg-surface-600",
  connecting: "bg-accent-amber animate-pulse",
  bootstrapping: "bg-accent-amber animate-pulse",
  ready: "bg-accent-emerald",
  error: "bg-accent-rose",
};

const statusText: Record<string, string> = {
  disconnected: "status.disconnected",
  connecting: "status.connecting",
  bootstrapping: "status.connecting",
  ready: "status.connected",
  error: "status.error",
};

function toggleConnection() {
  if (backend.connectionState.value === "ready") {
    backend.disconnect();
  } else {
    backend.connect();
  }
}

function close() {
  emit("update:modelValue", false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[10000] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="close" />

      <!-- Panel -->
      <div
        class="relative w-full max-w-md bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-6"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-surface-200">{{ t("settings.title") }}</h2>
          <button
            class="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            @click="close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Connection Status -->
        <div class="mb-5">
          <label class="block text-sm text-surface-400 mb-2">{{ t("settings.backend") }}</label>
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="statusColor[backend.connectionState.value] ?? 'bg-surface-600'"
            />
            <span
              class="text-sm flex-1"
              :class="
                backend.connectionState.value === 'ready'
                  ? 'text-accent-emerald'
                  : 'text-surface-400'
              "
            >
              {{ t(statusText[backend.connectionState.value] ?? "status.disconnected") }}
            </span>
            <button
              v-if="backend.isElectron"
              type="button"
              :disabled="restarting"
              :title="t('settings.restartAgent')"
              class="px-2 py-1 text-xs rounded bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-accent-cyan transition-colors disabled:opacity-40 disabled:cursor-wait flex items-center gap-1"
              @click="restartAgent"
            >
              <svg
                class="w-3 h-3"
                :class="restarting ? 'animate-spin' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{{ restarting ? t("settings.restarting") : t("settings.restartAgent") }}</span>
            </button>
          </div>
          <p v-if="backend.errorMessage.value" class="text-xs text-accent-rose mt-1">
            {{ backend.errorMessage.value }}
          </p>
        </div>

        <!-- Code Agent selector -->
        <div class="mb-5">
          <label class="block text-sm text-surface-400 mb-2">{{ t("settings.agent") }}</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in agentOptions"
              :key="opt.kind"
              type="button"
              :disabled="switching"
              :class="[
                'px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50',
                backend.activeBackendKind.value === opt.kind
                  ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan'
                  : 'border-surface-700 bg-surface-800 text-surface-300 hover:border-surface-600',
              ]"
              @click="selectAgent(opt.kind)"
            >
              {{ t(opt.labelKey) }}
            </button>
          </div>
          <p v-if="switching" class="text-[10px] text-surface-500 mt-1.5">
            {{ t("status.connecting") }}
          </p>
        </div>

        <!-- Server URL -->
        <div class="mb-4">
          <label class="block text-sm text-surface-400 mb-2">{{
            backend.activeBackendKind.value === "zero" ? t("settings.zero") : t("settings.opencode")
          }}</label>
          <div class="flex gap-2">
            <input
              v-model="urlInput"
              type="text"
              :placeholder="urlPlaceholder"
              class="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
              @keydown.enter="applyUrl"
            />
            <button
              class="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              :class="
                backend.connectionState.value === 'ready'
                  ? 'bg-accent-rose/15 text-accent-rose hover:bg-accent-rose/25'
                  : 'bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25'
              "
              @click="
                applyUrl();
                toggleConnection();
              "
            >
              {{
                backend.connectionState.value === "ready" ? t("chat.abort") : t("settings.backend")
              }}
            </button>
          </div>
        </div>

        <!-- Authorization (optional) -->
        <div class="mb-5">
          <label class="block text-xs text-surface-600 mb-1.5">Authorization</label>
          <input
            v-model="authInput"
            type="password"
            placeholder="Bearer ..."
            class="w-full px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            @keydown.enter="applyAuth"
          />
        </div>

        <!-- Language -->
        <div>
          <label class="block text-sm text-surface-400 mb-2">{{ t("settings.language") }}</label>
          <div class="flex gap-2">
            <button
              v-for="lang in languages"
              :key="lang.value"
              class="px-3 py-1.5 text-sm rounded-lg transition-colors"
              :class="
                selectedLang === lang.value
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-200 border border-transparent'
              "
              @click="changeLocale(lang.value)"
            >
              {{ lang.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
