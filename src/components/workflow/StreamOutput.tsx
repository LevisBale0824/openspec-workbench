import { useWorkflowStore } from "../../stores/workflow";

export function StreamOutput() {
  const { streamOutput, currentPhase } = useWorkflowStore();

  if (currentPhase !== "executing" && !streamOutput) return null;

  return (
    <div className="flex items-center gap-3 mb-4">
      {currentPhase === "executing" && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
          <span className="text-xs text-sky-400">正在执行...</span>
        </div>
      )}
    </div>
  );
}
