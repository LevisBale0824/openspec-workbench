import { useState, useRef, useEffect } from "react";
import { useWorkflowStore, StepName } from "../../stores/workflow";
import { useAgentStore } from "../../stores/agent";
import { InputModal } from "./InputModal";
import { StreamOutput } from "./StreamOutput";
import {
  CompassIcon,
  FileTextIcon,
  LightningIcon,
  ArchiveIcon,
  PlayIcon,
  RetryIcon,
  ArrowRightIcon,
} from "../common/Icons";

interface WorkflowStepProps {
  stepName: StepName;
}

const STEP_CONFIG: Record<
  StepName,
  {
    title: string;
    icon: typeof CompassIcon;
    description: string;
    color: string;
  }
> = {
  explore: {
    title: "需求探索",
    icon: CompassIcon,
    description: "分析需求目标，理解项目上下文与技术栈，识别影响范围。",
    color: "sky",
  },
  propose: {
    title: "方案提案",
    icon: FileTextIcon,
    description: "生成正式的技术提案文档，包含设计决策、影响评估和任务拆解。",
    color: "indigo",
  },
  apply: {
    title: "实施执行",
    icon: LightningIcon,
    description: "按任务逐项执行，TDD 方式开发，每个任务需通过测试验证。",
    color: "amber",
  },
  archive: {
    title: "归档验收",
    icon: ArchiveIcon,
    description: "验证所有产物完整，归档变更记录，标记任务完成。",
    color: "emerald",
  },
};

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

  const config = STEP_CONFIG[stepName];

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
      alert(
        `Agent "${activeAgent.name}" 不可用，请确认 CLI 工具已安装并在 PATH 中。\n\nOpenCode: npm install -g opencode\nZero: 请参考官方文档安装`,
      );
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

  // Input modal
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
    const StepIcon = config.icon;
    return (
      <div className="p-4 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-xl bg-${config.color}-500/10 flex items-center justify-center mb-4 text-${config.color}-400`}
          >
            <StepIcon size={24} />
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-slate-200 mb-1">{config.title}</h3>

          {/* Description */}
          <p className="text-xs text-slate-500 text-center leading-relaxed max-w-[220px] mb-6">
            {config.description}
          </p>

          {/* Start button */}
          <button
            onClick={handleStart}
            className={`inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${
              config.color === "sky"
                ? "from-sky-500 to-indigo-500"
                : config.color === "indigo"
                  ? "from-indigo-500 to-purple-500"
                  : config.color === "amber"
                    ? "from-amber-500 to-orange-500"
                    : "from-emerald-500 to-teal-500"
            } text-white rounded-xl font-medium text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-150`}
          >
            <PlayIcon size={14} />
            开始 {config.title}
          </button>
        </div>
      </div>
    );
  }

  // Executing state
  if (currentPhase === "executing") {
    return (
      <div className="p-3 flex flex-col h-full">
        <StreamOutput />
        <div
          ref={terminalRef}
          className="flex-1 bg-black/60 rounded-lg p-3 font-mono text-[11px] text-slate-300 leading-relaxed overflow-y-auto border border-slate-800 min-h-0"
        >
          {streamOutput || (
            <span className="text-slate-600">等待输出...</span>
          )}
          <span className="inline-block w-1.5 h-3 bg-sky-400 animate-pulse ml-0.5 align-middle" />
        </div>
      </div>
    );
  }

  // Reviewing state
  return (
    <div className="p-3 flex flex-col h-full">
      {/* Done banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-emerald-400 font-medium">执行完成</span>
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 bg-black/60 rounded-lg p-3 font-mono text-[11px] text-slate-300 leading-relaxed overflow-y-auto border border-slate-800 min-h-0"
      >
        {streamOutput}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs hover:border-slate-500 hover:text-slate-300 transition-all"
        >
          <RetryIcon size={13} />
          重试
        </button>
        <button
          onClick={async () => {
            setPhase("done");
            await advanceStep();
          }}
          className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-medium hover:scale-[1.01] transition-all"
        >
          下一步
          <ArrowRightIcon size={13} />
        </button>
      </div>
    </div>
  );
}
