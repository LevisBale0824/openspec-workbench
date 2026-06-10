import { useState, useRef, useEffect } from "react";
import { useWorkflowStore, StepName } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { InputModal } from "./InputModal";
import { StreamOutput } from "./StreamOutput";

interface WorkflowStepProps {
  stepName: StepName;
}

export function WorkflowStep({ stepName }: WorkflowStepProps) {
  const {
    currentPhase,
    streamOutput,
    setPhase,
    advanceStep,
    appendStreamOutput,
    clearStreamOutput,
  } = useWorkflowStore();
  const { activeAgent } = useAgentStore();
  const [showInput, setShowInput] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [streamOutput]);

  const handleStart = () => {
    setShowInput(true);
  };

  const handleCancelInput = () => {
    setShowInput(false);
  };

  const handleSubmit = async (prompt: string) => {
    if (!activeAgent) {
      alert("没有可用的 AI Agent，请在设置中配置并启动 Agent。");
      return;
    }

    const available = await activeAgent.isAvailable();
    if (!available) {
      alert(`Agent "${activeAgent.name}" 不可用，请确认 CLI 工具已安装并在 PATH 中。\n\nOpenCode: npm install -g opencode\nZero: 请参考官方文档安装`);
      return;
    }

    setShowInput(false);
    setPhase("executing");
    clearStreamOutput();

    try {
      for await (const chunk of activeAgent.executeStream({
        prompt,
        projectPath: "",
        workflow: stepName,
      })) {
        appendStreamOutput(chunk);
      }
    } catch (err) {
      appendStreamOutput(`\n\nError: ${err}`);
    }

    setPhase("reviewing");
  };

  // Input modal — renders as fixed overlay
  if (showInput) {
    return (
      <InputModal
        stepName={stepName}
        onSubmit={handleSubmit}
        onCancel={handleCancelInput}
      />
    );
  }

  // Idle state — compact for side panel
  if (currentPhase === "idle") {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="text-4xl mb-3 opacity-60">
            {stepName === "explore" && "🔍"}
            {stepName === "propose" && "📋"}
            {stepName === "apply" && "⚡"}
            {stepName === "archive" && "📦"}
          </div>
          <p className="text-slate-500 text-xs mb-5">
            {stepName === "explore" && "探索阶段：分析需求，理解项目上下文"}
            {stepName === "propose" && "提案阶段：生成正式提案和设计文档"}
            {stepName === "apply" && "实施阶段：逐任务执行，TDD 开发"}
            {stepName === "archive" && "归档阶段：验证并归档完成的变更"}
          </p>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 rounded-xl font-bold text-xs hover:scale-105 transition-transform"
          >
            🚀 开始 {stepName.charAt(0).toUpperCase() + stepName.slice(1)}
          </button>
        </div>
      </div>
    );
  }

  // Executing state — terminal output
  if (currentPhase === "executing") {
    return (
      <div className="p-3 flex flex-col h-full">
        <StreamOutput />
        <div
          ref={terminalRef}
          className="flex-1 bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 leading-relaxed overflow-y-auto border border-slate-700 min-h-0"
        >
          {streamOutput}
          <span className="inline-block w-1.5 h-3 bg-sky-400 animate-pulse ml-0.5 align-middle" />
        </div>
      </div>
    );
  }

  // Reviewing state — show stream result + actions
  return (
    <div className="p-3 flex flex-col h-full">
      <div className="text-xs text-emerald-400 mb-2 font-medium">✓ 执行完成</div>
      <div
        ref={terminalRef}
        className="flex-1 bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 leading-relaxed overflow-y-auto border border-slate-700 min-h-0"
      >
        {streamOutput}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowInput(true)}
          className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-400 text-xs hover:border-slate-400"
        >
          🔄 重试
        </button>
        <button
          onClick={async () => { setPhase("done"); await advanceStep(); }}
          className="flex-1 py-2 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 text-xs font-bold"
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}
