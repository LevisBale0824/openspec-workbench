import { useState, useEffect } from "react";
import { useAgentStore } from "../../stores/agent";

interface InputModalProps {
  stepName: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function InputModal({ stepName, onSubmit, onCancel }: InputModalProps) {
  const [prompt, setPrompt] = useState("");
  const [agentStatus, setAgentStatus] = useState<Record<string, boolean>>({});
  const { registry, activeAgent, setActive } = useAgentStore();
  const agents = registry.list();

  useEffect(() => {
    // Check availability of all agents on mount
    const check = async () => {
      const results: Record<string, boolean> = {};
      for (const agent of agents) {
        results[agent.name] = await agent.isAvailable();
      }
      setAgentStatus(results);
    };
    check();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[90%] max-w-xl border border-slate-700 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          🔍 {stepName} — 描述你的需求
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          输入你想探索的需求或问题，AI Agent 将分析项目并给出方案建议
        </p>

        <div className="flex gap-2 mb-3">
          {agents.map((agent) => {
            const status = agentStatus[agent.name];
            const isActive = activeAgent?.name === agent.name;
            return (
              <button
                key={agent.name}
                onClick={() => setActive(agent.name)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs text-center border transition-all ${
                  isActive
                    ? "border-sky-400 bg-sky-950 text-sky-300"
                    : "border-slate-600 bg-slate-900 text-slate-400"
                }`}
              >
                {status === true ? "🟢" : status === false ? "🔴" : "⏳"} {agent.name}
              </button>
            );
          })}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：我需要添加用户认证功能，支持 JWT + Refresh Token..."
          className="w-full h-28 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-y outline-none focus:border-sky-400 transition-colors"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm hover:border-slate-400"
          >
            取消
          </button>
          <button
            onClick={() => prompt.trim() && onSubmit(prompt.trim())}
            disabled={!prompt.trim()}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              prompt.trim()
                ? "bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            ▶ 执行 {stepName}
          </button>
        </div>
      </div>
    </div>
  );
}
