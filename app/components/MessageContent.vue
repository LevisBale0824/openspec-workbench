<script setup lang="ts">
import { computed, ref } from "vue";
import { stripSystemReminder, useMessages } from "../composables/useMessages";
import { renderMarkdown } from "../composables/useMarkdown";
import MessageFileChanges from "./MessageFileChanges.vue";

type DisplayBlock =
  | { kind: "text"; id: string; text: string; html?: string }
  | { kind: "reasoning"; id: string; text: string };

const props = defineProps<{ messageId: string }>();

const msgStore = useMessages();

const status = computed(() => msgStore.getStatus(props.messageId));
const message = computed(() => msgStore.get(props.messageId));
const isUser = computed(() => msgStore.get(props.messageId)?.role === "user");
const isStreaming = computed(() => status.value === "streaming");
const isError = computed(() => status.value === "error");
const error = computed(() => msgStore.getError(props.messageId));

// Keep the chat transcript focused on conversation. Tool calls are handled by
// floating tool windows, so they are intentionally omitted here.
const inlineBlocks = computed<DisplayBlock[]>(() => {
  const blocks: DisplayBlock[] = [];
  for (const part of msgStore.getParts(props.messageId)) {
    if (part.type === "text") {
      if (part.synthetic) continue;
      const text = stripSystemReminder(part.text);
      if (!text.trim()) continue;
      const html = isUser.value ? undefined : renderMarkdown(text);
      blocks.push({ kind: "text", id: part.id, text, html });
    } else if (part.type === "reasoning") {
      const text = part.text?.trim();
      if (!text) continue;
      blocks.push({ kind: "reasoning", id: part.id, text });
    }
  }
  return blocks;
});

const hasInlineContent = computed(() => inlineBlocks.value.length > 0);
const patchFiles = computed(() => {
  const files = new Set<string>();
  for (const part of msgStore.getParts(props.messageId)) {
    if (part.type !== "patch") continue;
    for (const file of part.files) files.add(file);
  }
  return [...files];
});
const messageDiffs = computed(() => {
  const direct = msgStore.getDiffs(props.messageId);
  if (direct?.length) return direct;

  const info = message.value;
  if (!info || info.role !== "assistant") return undefined;
  if (msgStore.getLatestAssistantMessageId(info.sessionID) !== info.id) return undefined;
  return msgStore.getSessionDiffs(info.sessionID);
});
const hasFileChanges = computed(
  () => Boolean(messageDiffs.value?.length) || patchFiles.value.length > 0,
);
const showThinking = computed(
  () =>
    isStreaming.value &&
    !isUser.value &&
    !hasInlineContent.value &&
    !hasFileChanges.value,
);

const expandedReasoning = ref<Record<string, boolean>>({});
function toggleReasoning(id: string) {
  expandedReasoning.value[id] = !expandedReasoning.value[id];
}
</script>

<template>
  <div>
    <template v-for="block in inlineBlocks" :key="block.id">
      <div
        v-if="block.kind === 'text' && block.html"
        class="md-content"
        v-html="block.html"
      />
      <div
        v-else-if="block.kind === 'text'"
        class="whitespace-pre-wrap break-words"
      >{{ block.text }}</div>

      <div v-else-if="block.kind === 'reasoning'" class="my-1">
        <button
          class="flex items-center gap-1 text-[11px] text-surface-500 transition-colors hover:text-surface-300"
          @click="toggleReasoning(block.id)"
        >
          <span class="text-[9px]">
            {{ expandedReasoning[block.id] ? "▾" : "▸" }}
          </span>
          <span>思考过程</span>
        </button>
        <div
          v-if="expandedReasoning[block.id]"
          class="mt-1 whitespace-pre-wrap border-l border-surface-700 pl-2 text-[12px] italic text-surface-400"
        >{{ block.text }}</div>
      </div>
    </template>

    <div v-if="showThinking" class="flex items-center gap-1.5 py-1.5">
      <span class="thinking-dot" />
      <span class="thinking-dot" />
      <span class="thinking-dot" />
      <span class="ml-1 text-[11px] text-surface-400">正在思考...</span>
    </div>

    <MessageFileChanges
      :diffs="messageDiffs"
      :patch-files="patchFiles"
    />

    <div v-if="isError" class="mt-1 text-xs text-accent-rose">
      {{ error?.message || "An error occurred" }}
    </div>
  </div>
</template>

<style scoped>
.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--color-accent-emerald, #34d399);
  opacity: 0.85;
  animation: thinking-bounce 1s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes thinking-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  40% {
    transform: translateY(-4px);
    opacity: 0.95;
  }
}
</style>
