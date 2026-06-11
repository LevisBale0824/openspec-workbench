import { useState, useEffect } from "react";
import { useAgentStore } from "../../stores/agent";
import { CloseIcon, PlayIcon, CheckIcon } from "../common/Icons";

interface InputModalProps {
  stepName: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

const STEP_TITLES: Record<string, string> = {
  explore: "需求探索",
  propose: "方案提案",
  apply: "实施执行",
  archive: "归档验收",
};

const STEP_HINTS: Record<string, string> = {
  explore: "描述你想探索的需求或问题，AI Agent 将分析项目并给出方案建议",
  propose: "基于探索结果，生成正式的技术提案文档",
  apply: "按任务逐项执行，使用 TDD 方式开发",
  archive: "验证变更产物并归档",
};

export function InputModal({ stepName, onSubmit, onCancel }: InputModalProps) {
  const [prompt, setPrompt] = useState("");
  const [agentStatus, setAgentStatus] = useState<Record<string, boolean>>({});
  const { registry, activeAgent, setActive } = useAgentStore();
  const agents = registry.list();

  useEffect(() => {
    const check = async () => {
      const results: Record<string, boolean> = {};
      for (const agent of agents) {
        results[agent.name] = await agent.isAvailable();
      }
      setAgentStatus(results);
    };
    check();
  }, []);

  const maxLength = 2000;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl p-6 w-[90%] max-w-xl border border-slate-800 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">
              {STEP_TITLES[stepName] || stepName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {STEP_HINTS[stepName] || "描述你的需求"}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {/* Agent Selector */}
        <div className="flex gap-2 mb-4">
          {agents.map((agent) => {
            const status = agentStatus[agent.name];
            const isActive = activeAgent?.name === agent.name;
            return (
              <button
                key={agent.name}
                onClick={() => setActive(agent.name)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs text-center border transition-all duration-150 ${
                  isActive
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                    : "border-slate-800 bg-slate-800/30 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      status === true
                        ? "bg-emerald-400"
                        : status === false
                          ? "bg-red-400"
                          : "bg-slate-600 animate-pulse"
                    }`}
                  />
                  {agent.name}
                  {isActive && <CheckIcon size={12} className="text-sky-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Prompt Input */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, maxLength))}
            placeholder="描述你想做什么..."
            className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200
                       placeholder:text-slate-600 resize-none outline-none
                       focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
            autoFocus
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-slate-600 tabular-nums">
            {prompt.length}/{maxLength}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-500 hover:text-slate-300 transition-all"
          >
            取消
          </button>
          <button
            onClick={() => prompt.trim() && onSubmit(prompt.trim())}
            disabled={!prompt.trim()}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              prompt.trim()
                ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/25 hover:scale-[1.02]"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <PlayIcon size={13} />
            执行
          </button>
        </div>
      </div>
    </div>
  );
}
