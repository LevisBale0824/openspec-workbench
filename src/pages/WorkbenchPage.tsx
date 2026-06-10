import { useWorkflowStore } from "../stores/workflow";
import { StepNav } from "../components/layout/StepNav";
import { WorkflowStep } from "../components/workflow/WorkflowStep";

export function WorkbenchPage() {
  const { currentStep } = useWorkflowStore();

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-100">
          OpenSpec Workbench
        </span>
        <span className="text-xs text-slate-600">—</span>
        <span className="text-xs text-slate-500">项目名</span>
      </div>

      {/* Step Navigation */}
      <div className="px-4 py-3">
        <StepNav />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <WorkflowStep stepName={currentStep} />
      </div>
    </div>
  );
}
