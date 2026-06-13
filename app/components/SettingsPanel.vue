<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useBackend } from "../composables/useBackend";
import { StorageKeys, storageSet } from "../utils/storageKeys";

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

// ── Backend URL ───────────────────────────────────────────────────────

const urlInput = ref(backend.baseUrl.value);
const authInput = ref(backend.authHeader.value ?? "");

watch(() => backend.baseUrl.value, (v) => { urlInput.value = v; });

function applyUrl() {
  backend.setBaseUrl(urlInput.value.trim());
}

function applyAuth() {
  backend.setAuthHeader(authInput.value.trim() || undefined);
}

// ── Connection ────────────────────────────────────────────────────────

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
      <div class="relative w-full max-w-md bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-surface-200">{{ t("settings.title") }}</h2>
          <button
            class="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            @click="close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Connection Status -->
        <div class="mb-5">
          <label class="block text-sm text-surface-400 mb-2">{{ t("settings.backend") }}</label>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" :class="statusColor[backend.connectionState.value] ?? 'bg-surface-600'" />
            <span class="text-sm" :class="backend.connectionState.value === 'ready' ? 'text-accent-emerald' : 'text-surface-400'">
              {{ t(statusText[backend.connectionState.value] ?? "status.disconnected") }}
            </span>
          </div>
          <p v-if="backend.errorMessage.value" class="text-xs text-accent-rose mt-1">{{ backend.errorMessage.value }}</p>
        </div>

        <!-- OpenCode Server URL -->
        <div class="mb-4">
          <label class="block text-sm text-surface-400 mb-2">{{ t("settings.opencode") }}</label>
          <div class="flex gap-2">
            <input
              v-model="urlInput"
              type="text"
              placeholder="http://localhost:13284"
              class="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
              @keydown.enter="applyUrl"
            />
            <button
              class="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              :class="backend.connectionState.value === 'ready'
                ? 'bg-accent-rose/15 text-accent-rose hover:bg-accent-rose/25'
                : 'bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25'"
              @click="applyUrl(); toggleConnection()"
            >
              {{ backend.connectionState.value === "ready" ? t("chat.abort") : t("settings.backend") }}
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
              :class="selectedLang === lang.value
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200 border border-transparent'"
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
