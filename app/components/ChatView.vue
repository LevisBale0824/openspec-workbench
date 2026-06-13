<script setup lang="ts">
import { computed } from "vue";
import MessageContent from "./MessageContent.vue";
import { stripSystemReminder, useMessages } from "../composables/useMessages";

const msgStore = useMessages();

function hasVisibleText(id: string): boolean {
  return msgStore.getParts(id).some((part) => {
    if (part.type !== "text" || part.synthetic) return false;
    return stripSystemReminder(part.text).trim().length > 0;
  });
}

function shouldShowMessage(id: string, role: string): boolean {
  if (role === "user") return msgStore.isDisplayable(id);
  return msgStore.getStatus(id) === "streaming" || hasVisibleText(id);
}

const allMessages = computed(() => {
  return msgStore
    .list()
    .filter((message) => shouldShowMessage(message.id, message.role))
    .map((message) => ({ id: message.id, role: message.role }));
});
</script>

<template>
  <div class="flex-1 overflow-y-auto px-5 py-5 md:px-10 lg:px-14">
    <!-- Empty state -->
    <div
      v-if="allMessages.length === 0"
      class="flex items-center justify-center h-full text-surface-600 text-sm"
    >
      Start a conversation...
    </div>

    <!-- Messages -->
    <div v-else class="w-full space-y-5">
      <div
        v-for="msg in allMessages"
        :key="msg.id"
        class="flex w-full items-start gap-3"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <template v-if="msg.role === 'assistant'">
          <!-- Avatar -->
          <div
            class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-emerald/20 text-[11px] font-bold text-accent-emerald"
          >
            AI
          </div>

          <!-- Bubble -->
          <div
            class="max-w-[min(760px,calc(100%-3.5rem))] rounded-lg bg-surface-800/80 px-4 py-3 text-sm leading-relaxed text-surface-200"
          >
            <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-emerald">
              Assistant
            </div>
            <MessageContent :message-id="msg.id" />
          </div>
        </template>

        <template v-else>
          <!-- Bubble -->
          <div
            class="max-w-[min(820px,calc(100%-3.5rem))] rounded-lg bg-accent-cyan/10 px-4 py-3 text-sm leading-relaxed text-surface-100"
          >
            <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-cyan">
              You
            </div>
            <MessageContent :message-id="msg.id" />
          </div>

          <!-- Avatar -->
          <div
            class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-cyan/20 text-[11px] font-bold text-accent-cyan"
          >
            U
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
