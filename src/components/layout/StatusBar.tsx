import { useProjectStore } from "../../stores/project";
import { useAgentStore } from "../../stores/agent";
import { useWorkflowStore, STEP_ORDER } from "../../stores/workflow";
import { CheckIcon } from "../common/Icons";

const STEP_LABELS: Record<string, string> = {
  explore: "Explore",
  propose: "Propose",
  apply: "Apply",
  archive: "Archive",
};

export function StatusBar() {
  const { projectPath } = useProjectStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const { currentStep, currentPhase } = useWorkflowStore();

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const phaseLabel =
    currentPhase === "idle"
      ? "就绪"
      : currentPhase === "executing"
        ? "执行中"
        : currentPhase === "reviewing"
          ? "审核中"
          : currentPhase;

  return (
    <div className="h-7 bg-slate-900 border-t border-slate-800 flex items-center px-3 gap-3 flex-shrink-0 select-none">
      {/* Project name */}
      <span
        className="text-[11px] text-slate-400 truncate max-w-[240px]"
        title={projectPath}
      >
        {projectPath ? projectPath.split(/[/\\]/).pop() : "未选择项目"}
      </span>

      <span className="text-slate-800 select-none">|</span>

      {/* Agent status */}
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isAvailable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" : "bg-red-400"
          }`}
        />
        <span className={isAvailable ? "text-slate-400" : "text-red-400"}>
          {activeAgent?.name || "无 Agent"}
        </span>
      </span>

      <span className="text-slate-800 select-none">|</span>

      {/* Workflow progress */}
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {STEP_ORDER.map((step, idx) => (
          <span key={step} className="flex items-center gap-0.5">
            {idx > 0 && <span className="text-slate-800">/</span>}
            {idx < stepIndex ? (
              <span className="text-emerald-500 flex items-center">
                <CheckIcon size={11} />
              </span>
            ) : idx === stepIndex ? (
              <span className="text-sky-400 font-medium">{STEP_LABELS[step]}</span>
            ) : (
              <span className="text-slate-600">{STEP_LABELS[step]}</span>
            )}
          </span>
        ))}
      </span>

      <span className="text-slate-800 select-none">|</span>

      <span className="text-[11px] text-slate-500">{phaseLabel}</span>

      <div className="flex-1" />

      <span className="text-[11px] text-slate-600">OpenSpec Workbench</span>
    </div>
  );
}
