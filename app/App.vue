<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import TopBar from "./components/TopBar.vue";
import SidePanel from "./components/SidePanel.vue";
import StatusBar from "./components/StatusBar.vue";
import InputPanel from "./components/InputPanel.vue";
import FloatingWindow from "./components/FloatingWindow.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import DiffViewer from "./components/DiffViewer.vue";
import { useRoute, useRouter } from "vue-router";
import { useFloatingWindows } from "./composables/useFloatingWindows";
import { useProject } from "./composables/useProject";
import { useBackend } from "./composables/useBackend";
import { useOpenSpec } from "./composables/useOpenSpec";
import { isElectron, onOpenFolder, selectDirectory } from "./utils/electronBridge";
import type { MessageDiffEntry } from "./types/message";

const route = useRoute();
const router = useRouter();
const sidePanelWidth = ref(300);
const showSettings = ref(false);
const backend = useBackend();
const inElectron = isElectron();

const showProjectDialog = ref(false);
const manualPath = ref("");

const isChatRoute = () => route.name === "chat";

// Floating window system (kept for tool-call streaming windows)
const fw = useFloatingWindows();
const floatingEntries = fw.entries;

function updateExtent() {
  fw.setExtent(window.innerWidth, window.innerHeight);
}

// Currently-selected workspace diff — shown in a right-side column instead of
// a floating window so the user can read it alongside the chat.
const activeDiff = ref<MessageDiffEntry | null>(null);

// Auto-close the diff viewer when the opened file is no longer in the
// workspace diffs (e.g. user deleted or reverted it externally). Only
// triggers when workspaceDiffs is non-empty so session-originated diffs
// (opened when there are no workspace changes) are left alone.
watch(
  () => backend.workspaceDiffs.value,
  (diffs) => {
    if (!activeDiff.value || diffs.length === 0) return;
    const stillExists = diffs.some((d) => d.file === activeDiff.value!.file);
    if (!stillExists) activeDiff.value = null;
  },
);

const project = useProject();
const openspec = useOpenSpec();
let unsubOpenFolder: (() => void) | null = null;

// On window focus / tab visibility: assume the user might have modified files
// externally (rm/mv/CLI). Without a fs watcher, polling on focus is the
// cheapest way to keep the Files tree + OpenSpec panel in sync.
function onFocusRefresh(): void {
  project.scheduleRefreshTree();
  openspec.scheduleRefresh();
  backend.scheduleWorkspaceDiffRefresh(400);
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") onFocusRefresh();
}

onMounted(() => {
  updateExtent();
  window.addEventListener("resize", updateExtent);
  window.addEventListener("focus", onFocusRefresh);
  document.addEventListener("visibilitychange", onVisibilityChange);
  unsubOpenFolder = onOpenFolder((dirPath) => {
    project.openDirectoryPath(dirPath);
    router.push({ name: "chat" });
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", updateExtent);
  window.removeEventListener("focus", onFocusRefresh);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  unsubOpenFolder?.();
});

function onWindowFocus(key: string) {
  fw.bringToFront(key);
}

function onWindowClose(key: string) {
  fw.close(key);
}

function onSelectSession(sessionId: string) {
  // Selecting a session means leaving the diff view — close any open file and
  // return to the chat.
  activeDiff.value = null;
  backend.selectSession(sessionId);
  router.push({ name: "chat" });
}

function onDeleteSession(sessionId: string) {
  backend.deleteSession(sessionId);
}

function onNewSession() {
  activeDiff.value = null;
  backend.startNewSession();
  router.push({ name: "chat" });
}

function onOpenDiff(diff: MessageDiffEntry) {
  activeDiff.value = diff;
}

function onCloseDiff() {
  activeDiff.value = null;
}

async function handleOpenFolder() {
  // Electron: trigger the native picker, then load the tree + jump to chat.
  if (inElectron) {
    const dir = await selectDirectory();
    if (!dir) return;
    project.openDirectoryPath(dir);
    router.push({ name: "chat" });
    return;
  }
  // Browser: try File System Access API (Chrome/Edge)
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
  manualPath.value = "";
  router.push({ name: "chat" });
}
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-950 text-surface-100 overflow-hidden">
    <!-- Top Bar -->
    <TopBar @toggle-settings="showSettings = !showSettings" @open-folder="handleOpenFolder" />

    <!-- Main Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Side Panel -->
      <SidePanel
        :style="{ width: `${sidePanelWidth}px` }"
        class="flex-shrink-0 border-r border-surface-800"
        :sessions="backend.sessions.value"
        :active-session-id="backend.selectedSessionId.value"
        :workspace-diffs="backend.workspaceDiffs.value"
        @select-session="onSelectSession"
        @delete-session="onDeleteSession"
        @new-session="onNewSession"
        @open-diff="onOpenDiff"
        @open-folder="handleOpenFolder"
      />

      <!-- Center Content: chat OR diff comparison (mutually exclusive) -->
      <main class="flex-1 flex flex-col overflow-hidden min-w-0">
        <template v-if="activeDiff">
          <div class="diff-toolbar">
            <span class="diff-toolbar-title" :title="activeDiff.file">
              {{ activeDiff.file }}
            </span>
            <button
              type="button"
              class="diff-toolbar-close"
              title="关闭对比视图"
              @click="onCloseDiff"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="diff-main">
            <DiffViewer :diff="activeDiff" />
          </div>
        </template>
        <template v-else>
          <router-view />
          <InputPanel v-if="isChatRoute()" />
        </template>
      </main>
    </div>

    <!-- Status Bar -->
    <StatusBar />

    <!-- Settings Modal -->
    <SettingsPanel v-model="showSettings" />

    <!-- Floating Window Overlay (tool-call windows) -->
    <div class="fixed inset-0 pointer-events-none" style="z-index: 9999">
      <FloatingWindow
        v-for="entry in floatingEntries"
        :key="entry.key"
        :entry="entry"
        :manager="fw"
        @focus="onWindowFocus"
        @close="onWindowClose"
      />
    </div>

    <!-- Manual path dialog (browser fallback for Open Project) -->
    <Teleport to="body">
      <div
        v-if="showProjectDialog"
        class="fixed inset-0 z-[10000] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60" @click="showProjectDialog = false" />
        <div
          class="relative w-full max-w-sm bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-5"
        >
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
</template>

<style scoped>
.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: color-mix(in srgb, var(--color-surface-900, #0f172a) 90%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--color-surface-800, #1e293b) 70%, transparent);
  flex: 0 0 auto;
}

.diff-toolbar-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--color-surface-200, #e2e8f0);
}

.diff-toolbar-close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-surface-500, #64748b);
  cursor: pointer;
}

.diff-toolbar-close:hover {
  background: color-mix(in srgb, var(--color-accent-rose, #f43f5e) 22%, transparent);
  color: var(--color-accent-rose, #f43f5e);
}

.diff-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
