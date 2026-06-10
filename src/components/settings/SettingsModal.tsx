import { useState } from "react";
import { useUIStore } from "../../stores/ui";
import { useAgentStore } from "../../stores/agent";

type SettingsTab = "agent" | "workflow" | "ui";

export function SettingsModal() {
  const { settingsModalOpen, closeSettings } = useUIStore();
  const { registry, activeAgent, setActive, checkAvailability } = useAgentStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("agent");
  const agents = registry.list();

  if (!settingsModalOpen) return null;

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "agent", label: "Agent" },
    { key: "workflow", label: "工作流" },
    { key: "ui", label: "界面" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeSettings}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-[560px] max-h-[480px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">设置</h2>
          <button onClick={closeSettings} className="text-slate-500 hover:text-slate-300 text-lg leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-sky-400 border-b-2 border-sky-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[360px]">
          {activeTab === "agent" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-3">选择 AI Agent 并检查可用性</p>
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  onClick={() => { setActive(agent.name); checkAvailability(); }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    activeAgent?.name === agent.name
                      ? "border-sky-400 bg-sky-950/50"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm text-slate-200">{agent.name}</span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                        {agent.type}
                      </span>
                    </div>
                    {activeAgent?.name === agent.name && (
                      <span className="text-sky-400 text-xs">● 当前</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "workflow" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 mb-3">工作流配置</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">默认 Change ID</label>
                  <input
                    type="text"
                    placeholder="留空则自动生成"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="auto-advance" className="rounded" />
                  <label htmlFor="auto-advance" className="text-xs text-slate-300">步骤完成后自动进入下一步</label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ui" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 mb-3">界面设置</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">主题</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none">
                    <option>深色 (Dark)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">编辑器字号</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none">
                    <option>12px</option>
                    <option>13px</option>
                    <option selected>14px</option>
                    <option>16px</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
