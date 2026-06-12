<script setup lang="ts">
import { computed } from "vue";
import type { MessageInfo, MessagePart, TextPart, ToolPart, ReasoningPart } from "../types/sse";
import { useMessages } from "../composables/useMessages";

const props = defineProps<{
  message: MessageInfo;
}>();

const msgStore = useMessages();

const isUser = computed(() => props.message.role === "user");
const status = computed(() => msgStore.getStatus(props.message.id));
const textContent = computed(() => msgStore.getTextContent(props.message.id));
const parts = computed(() => msgStore.getParts(props.message.id));

const textParts = computed(() =>
  parts.value.filter((p): p is TextPart => p.type === "text"),
);
const toolParts = computed(() =>
  parts.value.filter((p): p is ToolPart => p.type === "tool"),
);
const reasoningParts = computed(() =>
  parts.value.filter((p): p is ReasoningPart => p.type === "reasoning"),
);

const isStreaming = computed(() => status.value === "streaming");

function toolStatusLabel(state: ToolPart["state"]): string {
  switch (state.status) {
    case "pending": return "...";
    case "running": return "running";
    case "completed": return "done";
    case "error": return "error";
  }
}
</script>

<template>
  <div
    class="px-4 py-3"
    :class="isUser ? 'bg-surface-900/50' : 'bg-transparent'"
  >
    <!-- Role label -->
    <div class="flex items-center gap-2 mb-1.5">
      <span
        class="text-[10px] font-semibold uppercase tracking-wider"
        :class="isUser ? 'text-accent-cyan' : 'text-accent-emerald'"
      >
        {{ isUser ? 'You' : message.agent || 'Assistant' }}
      </span>
      <span v-if="isStreaming" class="text-[10px] text-accent-amber animate-pulse">
        streaming...
      </span>
      <span v-if="status === 'error'" class="text-[10px] text-accent-rose">
        error
      </span>
    </div>

    <!-- Reasoning blocks (collapsed by default) -->
    <details v-for="part in reasoningParts" :key="part.id" class="mb-2">
      <summary class="text-[10px] text-surface-500 cursor-pointer hover:text-surface-300">
        Reasoning
      </summary>
      <pre class="mt-1 text-xs text-surface-400 whitespace-pre-wrap font-mono bg-surface-900 rounded p-2 max-h-40 overflow-y-auto">{{ part.text }}</pre>
    </details>

    <!-- Text content -->
    <div v-if="textContent" class="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">
      {{ textContent }}
    </div>
    <div v-else-if="isStreaming" class="flex items-center gap-1">
      <span class="inline-block w-1.5 h-4 bg-accent-cyan/60 animate-pulse" />
    </div>

    <!-- Tool calls -->
    <div v-for="part in toolParts" :key="part.callID" class="mt-2">
      <div
        class="flex items-center gap-2 px-2 py-1 rounded text-xs"
        :class="{
          'bg-surface-800 text-surface-400': part.state.status === 'completed',
          'bg-accent-amber/10 text-accent-amber': part.state.status === 'running',
          'bg-accent-rose/10 text-accent-rose': part.state.status === 'error',
          'bg-surface-800/50 text-surface-500': part.state.status === 'pending',
        }"
      >
        <span class="font-mono">{{ part.tool }}</span>
        <span class="text-[10px] opacity-60">{{ toolStatusLabel(part.state) }}</span>
      </div>
    </div>
  </div>
</template>
