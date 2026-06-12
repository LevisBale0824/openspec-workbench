<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import TopBar from "./components/TopBar.vue";
import SidePanel from "./components/SidePanel.vue";
import StatusBar from "./components/StatusBar.vue";
import InputPanel from "./components/InputPanel.vue";
import FloatingWindow from "./components/FloatingWindow.vue";
import { useRoute } from "vue-router";
import { useFloatingWindows } from "./composables/useFloatingWindows";

const route = useRoute();
const sidePanelWidth = ref(280);
const showSettings = ref(false);

const isChatRoute = () => route.name === "chat";

// Floating window system
const fw = useFloatingWindows();
const floatingEntries = fw.entries;

// Track window extent for position clamping
function updateExtent() {
  fw.setExtent(window.innerWidth, window.innerHeight);
}

onMounted(() => {
  updateExtent();
  window.addEventListener("resize", updateExtent);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateExtent);
});

function onWindowFocus(key: string) {
  fw.bringToFront(key);
}

function onWindowClose(key: string) {
  fw.close(key);
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
      />

      <!-- Center Content -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <router-view />
        <InputPanel v-if="isChatRoute()" />
      </main>
    </div>

    <!-- Status Bar -->
    <StatusBar />

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
