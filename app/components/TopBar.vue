<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useProject } from "../composables/useProject";
import { useBackend } from "../composables/useBackend";
import {
  isElectron,
  onWindowMaximizeChange,
  selectDirectory,
  windowClose,
  windowIsMaximized,
  windowMinimize,
  windowToggleMaximize,
} from "../utils/electronBridge";

const { t } = useI18n();
const router = useRouter();
const project = useProject();
const backend = useBackend();
const projectState = computed(() => project.state);
const inElectron = isElectron();

const emit = defineEmits<{
  "toggle-settings": [];
}>();

const projectName = computed(() => projectState.value.directoryName || "");

const agentLabel = computed(() => {
  switch (backend.activeBackendKind.value) {
    case "zero":
      return t("welcome.agent.zero");
    case "cli-bridge":
      return "CLI Bridge";
    default:
      return t("welcome.agent.opencode");
  }
});

// Track maximize state so the toggle button shows the right glyph
// (square = currently maximized, will restore on click).
const isMaximized = ref(false);
let unsubMaximize: (() => void) | null = null;
onMounted(async () => {
  if (!inElectron) return;
  isMaximized.value = await windowIsMaximized();
  unsubMaximize = onWindowMaximizeChange((v) => {
    isMaximized.value = v;
  });
});
onUnmounted(() => {
  unsubMaximize?.();
});

async function openFolder() {
  // Browser: go to the Welcome page which has the directory picker UI.
  if (!inElectron) {
    router.push({ name: "home" });
    return;
  }
  // Electron: trigger the native picker, then load the tree + jump to chat.
  const dir = await selectDirectory();
  if (!dir) return;
  project.openDirectoryPath(dir);
  router.push({ name: "chat" });
}
</script>

<template>
  <header
    class="h-10 flex items-center justify-between px-3 bg-surface-900 border-b border-surface-800 select-none titlebar-drag"
  >
    <!-- Left: Logo + Title + Current Project -->
    <div class="flex items-center gap-2 min-w-0 titlebar-nodrag">
      <div
        class="w-5 h-5 rounded-full bg-gradient-to-br from-accent-cyan to-accent-indigo flex-shrink-0"
      />
      <span class="text-sm font-semibold text-surface-200 flex-shrink-0">{{ t("app.title") }}</span>
      <template v-if="projectName">
        <span class="text-surface-600">/</span>
        <button
          class="flex items-center gap-1 text-xs text-surface-300 hover:text-accent-cyan transition-colors truncate min-w-0"
          :title="projectState.directoryPath"
          @click="openFolder"
        >
          <svg
            class="w-3.5 h-3.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span class="truncate">{{ projectName }}</span>
        </button>
      </template>
    </div>

    <!-- Right: Agent label + Settings + Window controls -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <button
        class="px-2 py-1 text-xs text-surface-300 hover:text-accent-cyan hover:bg-surface-800 rounded transition-colors flex items-center gap-1 titlebar-nodrag"
        :title="t('topbar.agentLabel')"
        @click="emit('toggle-settings')"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
        <span>{{ agentLabel }}</span>
      </button>
      <button
        class="px-2 py-1 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded transition-colors titlebar-nodrag"
        @click="emit('toggle-settings')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <!-- Window controls (frameless mode only) -->
      <template v-if="inElectron">
        <span class="mx-1 w-px h-4 bg-surface-800" />
        <button
          class="w-8 h-7 flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded transition-colors titlebar-nodrag"
          title="Minimize"
          @click="windowMinimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          class="w-8 h-7 flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded transition-colors titlebar-nodrag"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          @click="windowToggleMaximize"
        >
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect
              x="2.5"
              y="4"
              width="5"
              height="5"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
            <path d="M4 4 V2.5 H9 V7.5 H7.5" stroke="currentColor" stroke-width="1" fill="none" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect
              x="2.5"
              y="2.5"
              width="7"
              height="7"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>
        <button
          class="w-8 h-7 flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-accent-rose rounded transition-colors titlebar-nodrag"
          title="Close"
          @click="windowClose"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3 L9 9 M9 3 L3 9"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
/* Frameless-window drag region. The whole header is draggable; interactive
   children opt out via .titlebar-nodrag. -webkit-app-region is inherited
   so applying no-drag on a wrapper covers nested buttons too. */
.titlebar-drag {
  -webkit-app-region: drag;
}

.titlebar-nodrag {
  -webkit-app-region: no-drag;
}
</style>
