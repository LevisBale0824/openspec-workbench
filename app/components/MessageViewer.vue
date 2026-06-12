<script setup lang="ts">
import { computed } from "vue";
import { useMessages } from "../composables/useMessages";
import ThreadBlock from "./ThreadBlock.vue";

const props = defineProps<{
  sessionId: string;
}>();

const msgStore = useMessages();
const thread = computed(() => msgStore.getThread(props.sessionId));
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div v-if="thread.length === 0" class="flex items-center justify-center h-full text-surface-600 text-sm">
      Start a conversation...
    </div>
    <div v-else class="divide-y divide-surface-800/50">
      <ThreadBlock
        v-for="message in thread"
        :key="message.id"
        :message="message"
      />
    </div>
  </div>
</template>
