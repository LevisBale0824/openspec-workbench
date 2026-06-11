import { useState } from "react";
import { useUIStore } from "../../stores/ui";
import { useAgentStore } from "../../stores/agent";
import { CloseIcon, CheckIcon } from "../common/Icons";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeSettings}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-[560px] max-h-[520px] overflow-hidden shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">设置</h2>
          <button
            onClick={closeSettings}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-all relative ${
                activeTab === tab.key
                  ? "text-sky-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[380px]">
          {activeTab === "agent" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4">
                选择 AI Agent 并检查可用性。Agent 需要对应的 CLI 工具已安装在 PATH 中。
              </p>
              {agents.map((agent) => {
                const isActive = activeAgent?.name === agent.name;
                return (
                  <div
                    key={agent.name}
                    onClick={() => {
                      setActive(agent.name);
                      checkAvailability();
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                      isActive
                        ? "border-sky-500/50 bg-sky-500/5"
                        : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isActive
                              ? "bg-sky-500/20 text-sky-400"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-sm text-slate-200">
                            {agent.name}
                          </span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-500 uppercase">
                            {agent.type}
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <span className="flex items-center gap-1 text-sky-400 text-xs">
                          <CheckIcon size={13} />
                          当前
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "workflow" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 mb-4">工作流配置</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    默认 Change ID
                  </label>
                  <input
                    type="text"
                    placeholder="留空则自动生成"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 outline-none transition-all"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500/20"
                  />
                  <span className="text-xs text-slate-300">
                    步骤完成后自动进入下一步
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === "ui" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 mb-4">界面设置</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">主题</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-all appearance-none">
                    <option>深色 (Dark)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    编辑器字号
                  </label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-all appearance-none">
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
