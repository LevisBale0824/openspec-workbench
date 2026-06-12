<script setup lang="ts">
import { useFloatingWindow } from "../../composables/useFloatingWindow";

const props = defineProps<{
  toolName?: string;
  description?: string;
  command?: string;
}>();

const emit = defineEmits<{
  reply: [decision: "allow-once" | "allow-always" | "reject"];
}>();

const floatingWindow = useFloatingWindow();
</script>

<template>
  <div class="permission-content">
    <div class="permission-header">
      <span class="permission-icon">&#9888;</span>
      <span class="permission-title">Permission Required</span>
    </div>
    <div v-if="toolName" class="permission-tool">{{ toolName }}</div>
    <div v-if="description" class="permission-desc">{{ description }}</div>
    <pre v-if="command" class="permission-command">{{ command }}</pre>
    <div class="permission-actions">
      <button class="permission-btn allow-once" @click="emit('reply', 'allow-once')">
        Allow Once
      </button>
      <button class="permission-btn allow-always" @click="emit('reply', 'allow-always')">
        Allow Always
      </button>
      <button class="permission-btn reject" @click="emit('reply', 'reject')">
        Reject
      </button>
    </div>
  </div>
</template>

<style scoped>
.permission-content {
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.permission-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.permission-icon {
  font-size: 18px;
  color: #f59e0b;
}

.permission-title {
  font-weight: 600;
  color: #e2e8f0;
}

.permission-tool {
  color: #a5b4fc;
  font-family: monospace;
  margin-bottom: 6px;
}

.permission-desc {
  color: #94a3b8;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.permission-command {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  overflow-x: auto;
  margin-bottom: 12px;
  white-space: pre-wrap;
  color: #cbd5e1;
}

.permission-actions {
  display: flex;
  gap: 8px;
}

.permission-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.permission-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.permission-btn.allow-once {
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.permission-btn.allow-always {
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.permission-btn.reject {
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}
</style>
