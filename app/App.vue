<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import TopBar from "./components/TopBar.vue";
import SidePanel from "./components/SidePanel.vue";
import StatusBar from "./components/StatusBar.vue";
import InputPanel from "./components/InputPanel.vue";
import FloatingWindow from "./components/FloatingWindow.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useRoute, useRouter } from "vue-router";
import { useFloatingWindows } from "./composables/useFloatingWindows";
import { useProject } from "./composables/useProject";
import { useBackend } from "./composables/useBackend";
import { onOpenFolder } from "./utils/electronBridge";

const route = useRoute();
const router = useRouter();
const sidePanelWidth = ref(280);
const showSettings = ref(false);
const backend = useBackend();

const isChatRoute = () => route.name === "chat";

// Floating window system
const fw = useFloatingWindows();
const floatingEntries = fw.entries;

// Track window extent for position clamping
function updateExtent() {
  fw.setExtent(window.innerWidth, window.innerHeight);
}

// Native menu: File → Open Folder. The main process already picked the path,
// so we just load the tree and switch to the chat view.
const project = useProject();
let unsubOpenFolder: (() => void) | null = null;

onMounted(() => {
  updateExtent();
  window.addEventListener("resize", updateExtent);
  unsubOpenFolder = onOpenFolder((dirPath) => {
    project.openDirectoryPath(dirPath);
    router.push({ name: "chat" });
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", updateExtent);
  unsubOpenFolder?.();
});

function onWindowFocus(key: string) {
  fw.bringToFront(key);
}

function onWindowClose(key: string) {
  fw.close(key);
}

function onSelectSession(sessionId: string) {
  backend.selectSession(sessionId);
  router.push({ name: "chat" });
}

function onDeleteSession(sessionId: string) {
  backend.deleteSession(sessionId);
}

function onNewSession() {
  backend.startNewSession();
  router.push({ name: "chat" });
}
</script>

<template>
  <div class="flex flex-col h-screen bg-surface-950 text-surface-100 overflow-hidden">
    <!-- Top Bar -->
    <TopBar @toggle-settings="showSettings = !showSettings" />

    <!-- Main Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Side Panel -->
      <SidePanel
        :style="{ width: `${sidePanelWidth}px` }"
        class="flex-shrink-0 border-r border-surface-800"
        :sessions="backend.sessions.value"
        :active-session-id="backend.selectedSessionId.value"
        @select-session="onSelectSession"
        @delete-session="onDeleteSession"
        @new-session="onNewSession"
      />

      <!-- Center Content -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <router-view />
        <InputPanel v-if="isChatRoute()" />
      </main>
    </div>

    <!-- Status Bar -->
    <StatusBar />

    <!-- Settings Modal -->
    <SettingsPanel v-model="showSettings" />

    <!-- Floating Window Overlay -->
    <div
      class="fixed inset-0 pointer-events-none"
      style="z-index: 9999"
    >
      <FloatingWindow
        v-for="entry in floatingEntries"
        :key="entry.key"
        :entry="entry"
        :manager="fw"
        @focus="onWindowFocus"
        @close="onWindowClose"
      />
    </div>
  </div>
</template>
