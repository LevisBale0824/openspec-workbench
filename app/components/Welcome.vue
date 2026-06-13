<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useProject } from "../composables/useProject";

const { t } = useI18n();
const router = useRouter();
const project = useProject();

const showProjectDialog = ref(false);
const manualPath = ref("");

function newSession() {
  router.push({ name: "chat" });
}

async function pickFolder() {
  // Try Electron native dialog first (returns absolute path)
  const nativeResult = await project.openDirectoryNative();
  if (nativeResult) {
    router.push({ name: "chat" });
    return;
  }
  // Try File System Access API (Chrome/Edge)
  if ("showDirectoryPicker" in window) {
    try {
    const handle = await window.showDirectoryPicker?.({ mode: "read" });
    if (!handle) throw new Error("No directory selected");
    await project.openDirectoryHandle(handle);
      router.push({ name: "chat" });
      return;
    } catch {
      // User cancelled or not allowed
    }
  }
  // Fallback: show manual input dialog
  showProjectDialog.value = true;
}

function submitManualPath() {
  const path = manualPath.value.trim();
  if (!path) return;
  project.openDirectoryPath(path);
  showProjectDialog.value = false;
  router.push({ name: "chat" });
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center max-w-md">
      <!-- Logo -->
      <div class="mb-6 flex justify-center">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-indigo to-accent-emerald opacity-80" />
      </div>

      <!-- Title -->
      <h1 class="text-xl font-bold text-surface-200 mb-2">
        {{ t("welcome.title") }}
      </h1>
      <p class="text-sm text-surface-500 mb-8">
        {{ t("welcome.subtitle") }}
      </p>

      <!-- Description -->
      <p class="text-xs text-surface-600 mb-6">
        {{ t("welcome.getStarted") }}
      </p>

      <!-- Actions -->
      <div class="flex gap-3 justify-center">
        <button class="px-4 py-2 text-sm font-medium rounded-lg bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25 transition-colors" @click="newSession">
          {{ t("welcome.newSession") }}
        </button>
        <button class="px-4 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors" @click="pickFolder">
          {{ t("welcome.openProject") }}
        </button>
      </div>

      <!-- Manual path dialog -->
      <Teleport to="body">
        <div v-if="showProjectDialog" class="fixed inset-0 z-[10000] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60" @click="showProjectDialog = false" />
          <div class="relative w-full max-w-sm bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-5">
            <h3 class="text-sm font-semibold text-surface-200 mb-3">Open Project</h3>
            <input
              v-model="manualPath"
              type="text"
              placeholder="/path/to/project"
              class="w-full px-3 py-2 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent-cyan/50 mb-3"
              @keydown.enter="submitManualPath"
            />
            <div class="flex justify-end gap-2">
              <button
                class="px-3 py-1.5 text-xs rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
                @click="showProjectDialog = false"
              >
                Cancel
              </button>
              <button
                class="px-3 py-1.5 text-xs rounded-lg bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25 transition-colors disabled:opacity-30"
                :disabled="!manualPath.trim()"
                @click="submitManualPath"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
