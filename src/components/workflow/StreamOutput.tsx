import { useWorkflowStore } from "../../stores/workflow";

export function StreamOutput() {
  const { streamOutput, currentPhase } = useWorkflowStore();

  if (currentPhase !== "executing" && !streamOutput) return null;

  return (
    <div className="flex items-center gap-3 mb-3">
      {currentPhase === "executing" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 w-full">
          <div className="w-3 h-3 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
          <span className="text-[11px] text-sky-400 font-medium">
            正在执行...
          </span>
          {streamOutput && (
            <span className="text-[10px] text-slate-600 ml-auto">
              {streamOutput.length.toLocaleString()} 字符
            </span>
          )}
        </div>
      )}
    </div>
  );
}
