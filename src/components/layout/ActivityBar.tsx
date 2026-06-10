import { useUIStore } from "../../stores/ui";

const icons = [
  { panel: "file-explorer" as const, icon: "📁", label: "文件浏览器" },
  { panel: "search" as const, icon: "🔍", label: "搜索" },
];

export function ActivityBar() {
  const { activeSidebarPanel, setActiveSidebarPanel, toggleWorkflowPanel, openSettings } =
    useUIStore();

  return (
    <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-2 gap-1 flex-shrink-0">
      {icons.map(({ panel, icon, label }) => (
        <button
          key={panel}
          onClick={() => setActiveSidebarPanel(panel)}
          title={label}
          className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors ${
            activeSidebarPanel === panel
              ? "bg-slate-700 text-white"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          }`}
        >
          {icon}
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={toggleWorkflowPanel}
        title="工作流面板"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
      >
        ⚡
      </button>

      <button
        onClick={openSettings}
        title="设置"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
      >
        ⚙️
      </button>
    </div>
  );
}
