// ---------------------------------------------------------------------------
// OpenSpec Workflow Plugin
// ---------------------------------------------------------------------------
// Registers the 4-step workflow (EXPLORE → PROPOSE → APPLY → ARCHIVE)
// as a Vue plugin. Disabled by default; toggle in settings.
// ---------------------------------------------------------------------------

import type { App, Plugin } from "vue";
import type { OpenSpecPlugin } from "./pluginTypes";
import { STEP_ORDER, createDefaultWorkflowState, type StepName, type StepPhase, type WorkflowState } from "../types/workflow";
import { reactive, ref } from "vue";

// ── Module-level workflow state ───────────────────────────────────────────

const workflowState = ref<WorkflowState>(createDefaultWorkflowState());
const workflowEnabled = ref(false);

function setStepPhase(step: StepName, phase: StepPhase) {
  const state = workflowState.value;
  state.steps[step].phase = phase;
}

function setActiveStep(step: StepName) {
  workflowState.value.activeStep = step;
}

function resetWorkflow() {
  workflowState.value = createDefaultWorkflowState();
}

function enableWorkflow() {
  workflowEnabled.value = true;
  workflowState.value.enabled = true;
}

function disableWorkflow() {
  workflowEnabled.value = false;
  workflowState.value.enabled = false;
  resetWorkflow();
}

function nextStep(): boolean {
  const current = workflowState.value.activeStep;
  const idx = STEP_ORDER.indexOf(current);
  if (idx >= STEP_ORDER.length - 1) return false;
  const next = STEP_ORDER[idx + 1];
  setActiveStep(next);
  setStepPhase(next, "input");
  setStepPhase(current, "done");
  return true;
}

export const workflowPlugin: OpenSpecPlugin = {
  name: "openspec-workflow",
  description: "4-step workflow: Explore → Propose → Apply → Archive",
  enabled: false,

  install(app: App) {
    // Provide workflow state globally
    app.provide("workflowState", workflowState);
    app.provide("workflowEnabled", workflowEnabled);

    // Expose workflow API via global properties
    app.config.globalProperties.$workflow = {
      state: workflowState,
      enabled: workflowEnabled,
      setActiveStep,
      setStepPhase,
      nextStep,
      reset: resetWorkflow,
      enable: enableWorkflow,
      disable: disableWorkflow,
    };
  },
};

// ── Composable ────────────────────────────────────────────────────────────

export function useWorkflow() {
  return {
    state: workflowState,
    enabled: workflowEnabled,
    setActiveStep,
    setStepPhase,
    nextStep,
    reset: resetWorkflow,
    enable: enableWorkflow,
    disable: disableWorkflow,
  };
}
