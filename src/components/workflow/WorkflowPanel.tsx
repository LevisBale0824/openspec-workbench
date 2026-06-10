import { useWorkflowStore, StepName } from "../../stores/workflow";
import { StepNav } from "../layout/StepNav";
import { WorkflowStep } from "./WorkflowStep";

const steps: StepName[] = ["explore", "propose", "apply", "archive"];

export function WorkflowPanel() {
  const { currentStep } = useWorkflowStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-slate-800 flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">工作流</h3>
      </div>
      <StepNav steps={steps} currentStep={currentStep} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <WorkflowStep stepName={currentStep} />
      </div>
    </div>
  );
}
