import { useWorkflowStore, StepName } from "../../stores/workflow";
import { useUIStore } from "../../stores/ui";
import { StepNav } from "../layout/StepNav";
import { WorkflowStep } from "./WorkflowStep";
import { WorkflowIcon } from "../common/Icons";

const steps: StepName[] = ["explore", "propose", "apply", "archive"];

export function WorkflowPanel() {
  const { currentStep } = useWorkflowStore();
  const { editorVisible, toggleEditor } = useUIStore();

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-800 flex-shrink-0 flex items-center gap-2">
        <span className="text-sky-400">
          <WorkflowIcon size={14} />
        </span>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-1">
          工作流
        </h3>
        <button
          onClick={toggleEditor}
          title={editorVisible ? "隐藏编辑器" : "显示编辑器"}
          className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {editorVisible ? (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="m16 9-4 3 4 3" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M15 3v18" />
                <path d="m8 9 4 3-4 3" />
              </>
            )}
          </svg>
        </button>
      </div>
      <StepNav steps={steps} currentStep={currentStep} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <WorkflowStep stepName={currentStep} />
      </div>
    </div>
  );
}
