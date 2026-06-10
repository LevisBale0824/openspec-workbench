import { useState } from "react";
import { useWorkflowStore, StepName } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { ArtifactTabs } from "../layout/ArtifactTabs";
import { DocViewer } from "../layout/DocViewer";
import { ChatPanel } from "../layout/ChatPanel";
import { ActionBar } from "../layout/ActionBar";
import { InputModal } from "./InputModal";
import { StreamOutput } from "./StreamOutput";

interface WorkflowStepProps {
  stepName: StepName;
}

export function WorkflowStep({ stepName }: WorkflowStepProps) {
  const {
    currentPhase,
    streamOutput,
    artifacts,
    setPhase,
    advanceStep,
    markReviewed,
    appendStreamOutput,
    clearStreamOutput,
  } = useWorkflowStore();
  const { activeAgent, isAvailable } = useAgentStore();
  const [showInput, setShowInput] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

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
      alert(`Agent "${activeAgent.name}" 不可用，请确认服务已启动。\n\nOpenCode: 需要在 localhost:3000 运行\nZero: 需要在 localhost:8080 运行`);
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

  const handleRetry = () => {
    setShowInput(true);
  };

  const handleNext = async () => {
    setPhase("done");
    await advanceStep();
  };

  // Input modal (must check before idle — local state overrides phase)
  if (showInput) {
    return (
      <InputModal
        stepName={stepName}
        onSubmit={handleSubmit}
        onCancel={handleCancelInput}
      />
    );
  }

  // Idle state
  if (currentPhase === "idle") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 opacity-60">
            {stepName === "explore" && "🔍"}
            {stepName === "propose" && "📋"}
            {stepName === "apply" && "⚡"}
            {stepName === "archive" && "📦"}
          </div>
          <p className="text-slate-500 text-sm mb-5">
            {stepName === "explore" && "探索阶段：分析需求，理解项目上下文"}
            {stepName === "propose" && "提案阶段：生成正式提案和设计文档"}
            {stepName === "apply" && "实施阶段：逐任务执行，TDD 开发"}
            {stepName === "archive" && "归档阶段：验证并归档完成的变更"}
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
          >
            🚀 开始 {stepName.charAt(0).toUpperCase() + stepName.slice(1)}
          </button>
        </div>
      </div>
    );
  }

  // Executing state
  if (currentPhase === "executing") {
    return (
      <div className="flex-1 p-5">
        <StreamOutput />
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed min-h-[300px] border border-slate-700">
          {streamOutput}
          <span className="inline-block w-2 h-3.5 bg-sky-400 animate-pulse ml-0.5 align-middle" />
        </div>
      </div>
    );
  }

  // Reviewing state
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document review */}
        <div className="flex-[3] flex flex-col border-r border-slate-700">
          <ArtifactTabs
            activeArtifact={activeArtifactId}
            onSelect={setActiveArtifactId}
          />
          <DocViewer filePath={activeArtifactId} />
        </div>

        {/* Right: Chat panel */}
        <div className="flex-[2]">
          <ChatPanel />
        </div>
      </div>

      <ActionBar
        onMarkReviewed={() => activeArtifactId && markReviewed(activeArtifactId)}
        onRetry={handleRetry}
        onNext={handleNext}
      />
    </div>
  );
}
