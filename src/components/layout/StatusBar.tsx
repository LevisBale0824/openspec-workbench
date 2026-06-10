import { useProjectStore } from "../../stores/project";
import { useAgentStore } from "../../stores/agent";
import { useWorkflowStore } from "../../stores/workflow";

export function StatusBar() {
  const { projectPath } = useProjectStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const { currentStep, currentPhase } = useWorkflowStore();

  return (
    <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center px-3 text-[11px] text-slate-500 gap-4 flex-shrink-0">
      <span className="truncate max-w-[300px]" title={projectPath}>
        {projectPath ? projectPath.split(/[/\\]/).pop() : "未选择项目"}
      </span>

      <span className="text-slate-700">|</span>

      <span className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-emerald-400" : "bg-red-400"}`} />
        {activeAgent?.name || "无 Agent"}
      </span>

      <span className="text-slate-700">|</span>

      <span>
        {currentStep} — {currentPhase === "idle" ? "就绪" : currentPhase === "executing" ? "执行中" : currentPhase === "reviewing" ? "审核中" : currentPhase}
      </span>

      <div className="flex-1" />

      <span>OpenSpec Workbench</span>
    </div>
  );
}
