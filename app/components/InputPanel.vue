<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const inputText = ref("");
const isSending = ref(false);

const emit = defineEmits<{
  send: [text: string];
  abort: [];
}>();

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleSend() {
  const text = inputText.value.trim();
  if (!text || isSending.value) return;
  emit("send", text);
  inputText.value = "";
}
</script>

<template>
  <div class="border-t border-surface-800 bg-surface-900 px-4 py-3">
    <div class="flex items-end gap-2 max-w-3xl mx-auto">
      <textarea
        v-model="inputText"
        :placeholder="t('chat.placeholder')"
        :disabled="isSending"
        rows="1"
        class="flex-1 resize-none rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-accent-cyan/50 transition-colors"
        @keydown="handleKeydown"
      />
      <button
        v-if="!isSending"
        :disabled="!inputText.trim()"
        class="px-3 py-2 text-sm font-medium rounded-lg bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        @click="handleSend"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
      <button
        v-else
        class="px-3 py-2 text-sm font-medium rounded-lg bg-accent-rose/15 text-accent-rose hover:bg-accent-rose/25 transition-colors"
        @click="$emit('abort')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
