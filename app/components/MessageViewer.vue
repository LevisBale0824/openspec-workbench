<script setup lang="ts">
import { computed } from "vue";
import { stripSystemReminder, useMessages } from "../composables/useMessages";
import ThreadBlock from "./ThreadBlock.vue";

const props = defineProps<{
  sessionId: string;
}>();

const msgStore = useMessages();
function hasVisibleText(id: string): boolean {
  return msgStore.getParts(id).some((part) => {
    if (part.type !== "text" || part.synthetic) return false;
    return stripSystemReminder(part.text).trim().length > 0;
  });
}

const thread = computed(() =>
  msgStore.getThread(props.sessionId).filter((message) => {
    if (message.role === "user") return msgStore.isDisplayable(message.id);
    return msgStore.getStatus(message.id) === "streaming" || hasVisibleText(message.id);
  }),
);
</script>

<template>
  <div class="flex-1 overflow-y-auto py-4">
    <div v-if="thread.length === 0" class="flex items-center justify-center h-full text-surface-600 text-sm">
      Start a conversation...
    </div>
    <div v-else class="space-y-2">
      <ThreadBlock
        v-for="message in thread"
        :key="message.id"
        :message="message"
      />
    </div>
  </div>
</template>
