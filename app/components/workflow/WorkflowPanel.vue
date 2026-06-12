<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkflow } from "../../plugins/workflowPlugin";
import { STEP_ORDER, type StepName } from "../../types/workflow";
import StepNav from "./StepNav.vue";

const { t } = useI18n();
const { state, enabled, setActiveStep, setStepPhase, nextStep } = useWorkflow();

const steps = computed(() =>
  STEP_ORDER.map((name) => ({
    name,
    label: t(`workflow.${name}`),
    phase: state.value.steps[name].phase,
    active: state.value.activeStep === name,
  })),
);
</script>

<template>
  <div v-if="enabled" class="border-b border-surface-800 bg-surface-900 px-4 py-2">
    <div class="flex items-center gap-4 max-w-3xl mx-auto">
      <!-- Step indicators -->
      <StepNav :steps="steps" @select="setActiveStep" />

      <!-- Next step button -->
      <button
        class="px-3 py-1 text-xs font-medium rounded bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 disabled:opacity-30 transition-colors"
        :disabled="state.steps[state.activeStep].phase !== 'done'"
        @click="nextStep()"
      >
        {{ t("workflow.next") }}
      </button>
    </div>
  </div>
</template>
