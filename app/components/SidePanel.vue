<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import SessionTree from "./SessionTree.vue";
import type { SessionInfo } from "../types/sse";

const { t } = useI18n();
const activeTab = ref<"sessions" | "files">("sessions");

const props = withDefaults(
  defineProps<{
    sessions?: SessionInfo[];
    activeSessionId?: string;
  }>(),
  {
    sessions: () => [],
    activeSessionId: "",
  },
);

const emit = defineEmits<{
  "select-session": [sessionId: string];
  "new-session": [];
}>();
</script>

<template>
  <aside class="flex flex-col h-full bg-surface-900">
    <!-- Tab Header -->
    <div class="flex border-b border-surface-800">
      <button
        v-for="tab in (['sessions', 'files'] as const)"
        :key="tab"
        class="flex-1 py-2 text-xs font-medium transition-colors"
        :class="activeTab === tab
          ? 'text-accent-cyan border-b-2 border-accent-cyan'
          : 'text-surface-500 hover:text-surface-300'"
        @click="activeTab = tab"
      >
        {{ t(`sidebar.${tab}`) }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <template v-if="activeTab === 'sessions'">
        <SessionTree
          :sessions="sessions"
          :active-session-id="activeSessionId"
          @select="emit('select-session', $event)"
        />
      </template>
      <template v-else>
        <div class="text-center py-8 text-surface-600 text-sm">
          {{ t("welcome.openProject") }}
        </div>
      </template>
    </div>

    <!-- New Session Button -->
    <div v-if="activeTab === 'sessions'" class="p-2 border-t border-surface-800">
      <button
        class="w-full py-1.5 text-xs font-medium rounded bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
        @click="emit('new-session')"
      >
        + {{ t("sidebar.newSession") }}
      </button>
    </div>
  </aside>
</template>
