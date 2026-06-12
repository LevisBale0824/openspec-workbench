<script setup lang="ts">
import type { StepName } from "../../types/workflow";

type StepItem = {
  name: StepName;
  label: string;
  phase: string;
  active: boolean;
};

defineProps<{
  steps: StepItem[];
}>();

const emit = defineEmits<{
  select: [step: StepName];
}>();

function phaseIcon(phase: string): string {
  switch (phase) {
    case "done": return "done";
    case "executing": return "running";
    case "input":
    case "reviewing": return "active";
    default: return "idle";
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <template v-for="(step, i) in steps" :key="step.name">
      <!-- Step button -->
      <button
        class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
        :class="{
          'bg-accent-cyan/15 text-accent-cyan': step.active,
          'text-surface-400 hover:text-surface-200': !step.active,
        }"
        @click="emit('select', step.name)"
      >
        <!-- Phase indicator -->
        <span
          class="w-2 h-2 rounded-full"
          :class="{
            'bg-accent-emerald': step.phase === 'done',
            'bg-accent-amber animate-pulse': step.phase === 'executing',
            'bg-accent-cyan': step.active && step.phase !== 'done',
            'bg-surface-600': step.phase === 'idle' && !step.active,
          }"
        />
        <span>{{ step.label }}</span>
      </button>

      <!-- Connector -->
      <svg v-if="i < steps.length - 1" class="w-4 h-4 text-surface-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </template>
  </div>
</template>
