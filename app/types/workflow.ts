// ---------------------------------------------------------------------------
// OpenSpec Workflow Type Definitions
// ---------------------------------------------------------------------------
// Ported from openspec-workbench-py/core/types.py (StepName, StepPhase)
// and core/workflow_engine.rs (STEP_ORDER)
// ---------------------------------------------------------------------------

/** Workflow step names in fixed order. */
export type StepName = "explore" | "propose" | "apply" | "archive";

/** Phase within a single workflow step. */
export type StepPhase =
  | "idle"
  | "input"
  | "executing"
  | "reviewing"
  | "done";

/** Fixed step order — matches the canonical sequence. */
export const STEP_ORDER: StepName[] = [
  "explore",
  "propose",
  "apply",
  "archive",
];

/** State for a single workflow step. */
export type StepState = {
  name: StepName;
  phase: StepPhase;
  sessionId?: string;
  input?: string;
  output?: string;
};

/** Top-level workflow state. */
export type WorkflowState = {
  activeStep: StepName;
  steps: Record<StepName, StepState>;
  enabled: boolean;
};

/** Create a default workflow state. */
export function createDefaultWorkflowState(): WorkflowState {
  const steps: Record<StepName, StepState> = {} as Record<
    StepName,
    StepState
  >;
  for (const name of STEP_ORDER) {
    steps[name] = { name, phase: "idle" };
  }
  return { activeStep: "explore", steps, enabled: false };
}
