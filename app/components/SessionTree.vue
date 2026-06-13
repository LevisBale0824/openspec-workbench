<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { SessionInfo } from "../types/sse";

const { t } = useI18n();

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
  select: [sessionId: string];
  delete: [sessionId: string];
}>();

const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => {
    // Pinned first
    if (a.time.pinned && !b.time.pinned) return -1;
    if (!a.time.pinned && b.time.pinned) return 1;
    // Then by updated time descending
    return (b.time.updated ?? 0) - (a.time.updated ?? 0);
  });
});

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t("sidebar.justNow");
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function statusIcon(session: SessionInfo): string {
  if (session.time.archived) return "archived";
  if (session.time.pinned) return "pinned";
  return "";
}
</script>

<template>
  <div class="space-y-0.5">
    <button
      v-for="session in sortedSessions"
      :key="session.id"
      class="w-full text-left px-2 py-1.5 rounded text-xs transition-colors group"
      :class="activeSessionId === session.id
        ? 'bg-accent-cyan/10 text-surface-100'
        : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'"
      @click="emit('select', session.id)"
    >
      <div class="flex items-center gap-1.5">
        <!-- Status indicator -->
        <span
          v-if="statusIcon(session)"
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :class="statusIcon(session) === 'pinned' ? 'bg-accent-amber' : 'bg-surface-600'"
        />
        <span v-else class="w-1.5 h-1.5 flex-shrink-0" />

        <!-- Title -->
        <span class="truncate flex-1">
          {{ session.title || session.id.slice(0, 8) }}
        </span>

        <!-- Time -->
        <span class="text-[10px] text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">
          {{ formatTime(session.time.updated) }}
        </span>

        <!-- Delete button -->
        <button
          class="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded hover:bg-accent-rose/20 hover:text-accent-rose text-surface-500 transition-all"
          :title="t('sidebar.deleteSession')"
          @click.stop="emit('delete', session.id)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        </button>
      </div>
    </button>

    <div v-if="sortedSessions.length === 0" class="text-center py-8 text-surface-600 text-sm">
      {{ t("sidebar.noSessions") }}
    </div>
  </div>
</template>
