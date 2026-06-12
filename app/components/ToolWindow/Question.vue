<script setup lang="ts">
import { ref } from "vue";
import { useFloatingWindow } from "../../composables/useFloatingWindow";

const props = defineProps<{
  question?: string;
  options?: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  reply: [answer: string];
}>();

const floatingWindow = useFloatingWindow();
const customAnswer = ref("");
const selectedOption = ref("");
</script>

<template>
  <div class="question-content">
    <div class="question-header">
      <span class="question-icon">&#63;</span>
      <span class="question-title">Question</span>
    </div>
    <div v-if="question" class="question-text">{{ question }}</div>
    <div v-if="options && options.length > 0" class="question-options">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="question-option-btn"
        :class="{ selected: selectedOption === opt.value }"
        @click="selectedOption = opt.value; emit('reply', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
    <div class="question-custom">
      <input
        v-model="customAnswer"
        class="question-input"
        type="text"
        placeholder="Or type your answer..."
        @keydown.enter="customAnswer.trim() && emit('reply', customAnswer.trim())"
      />
      <button
        class="question-send-btn"
        :disabled="!customAnswer.trim()"
        @click="customAnswer.trim() && emit('reply', customAnswer.trim())"
      >
        Send
      </button>
    </div>
  </div>
</template>

<style scoped>
.question-content {
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.question-icon {
  font-size: 16px;
  font-weight: 700;
  color: #60a5fa;
}

.question-title {
  font-weight: 600;
  color: #e2e8f0;
}

.question-text {
  color: #cbd5e1;
  margin-bottom: 10px;
  white-space: pre-wrap;
}

.question-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.question-option-btn {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.question-option-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.question-option-btn.selected {
  border-color: rgba(96, 165, 250, 0.6);
  background: rgba(96, 165, 250, 0.15);
}

.question-custom {
  display: flex;
  gap: 6px;
}

.question-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 12px;
  outline: none;
}

.question-input:focus {
  border-color: rgba(96, 165, 250, 0.6);
}

.question-send-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid rgba(96, 165, 250, 0.4);
  background: rgba(96, 165, 250, 0.15);
  color: #93c5fd;
  font-size: 12px;
  cursor: pointer;
}

.question-send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
