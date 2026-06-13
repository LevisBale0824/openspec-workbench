<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useProject } from "../composables/useProject";
import { isElectron, selectDirectory } from "../utils/electronBridge";

const { t } = useI18n();
const router = useRouter();
const project = useProject();
const projectState = computed(() => project.state);

defineEmits<{
  "toggle-settings": [];
}>();

const projectName = computed(() => projectState.value.directoryName || "");

async function openFolder() {
  // Browser: go to the Welcome page which has the directory picker UI.
  if (!isElectron()) {
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
  <header class="h-10 flex items-center justify-between px-3 bg-surface-900 border-b border-surface-800 select-none">
    <!-- Left: Logo + Title + Current Project -->
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-5 h-5 rounded-full bg-gradient-to-br from-accent-cyan to-accent-indigo flex-shrink-0" />
      <span class="text-sm font-semibold text-surface-200 flex-shrink-0">{{ t("app.title") }}</span>
      <template v-if="projectName">
        <span class="text-surface-600">/</span>
        <button
          class="flex items-center gap-1 text-xs text-surface-300 hover:text-accent-cyan transition-colors truncate min-w-0"
          :title="projectState.directoryPath"
          @click="openFolder"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="truncate">{{ projectName }}</span>
        </button>
      </template>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <button
        class="px-2 py-1 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded transition-colors"
        @click="$emit('toggle-settings')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </header>
</template>
