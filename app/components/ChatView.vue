<script setup lang="ts">
import { useMessages } from "../composables/useMessages";
import ThreadBlock from "./ThreadBlock.vue";

const msgStore = useMessages();
const roots = msgStore.roots;
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    <ThreadBlock
      v-for="msg in roots"
      :key="msg.id"
      :message="msg"
    />
    <div
      v-if="roots.length === 0"
      class="flex items-center justify-center h-full text-surface-600 text-sm"
    >
      Start a conversation...
    </div>
  </div>
</template>
