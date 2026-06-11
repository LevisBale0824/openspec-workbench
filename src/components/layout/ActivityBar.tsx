import { useUIStore } from "../../stores/ui";
import {
  FolderIcon,
  SearchIcon,
  WorkflowIcon,
  SettingsIcon,
} from "../common/Icons";

const icons = [
  { panel: "file-explorer" as const, icon: FolderIcon, label: "文件浏览器" },
  { panel: "search" as const, icon: SearchIcon, label: "搜索" },
];

export function ActivityBar() {
  const {
    activeSidebarPanel,
    setActiveSidebarPanel,
    toggleWorkflowPanel,
    workflowPanelVisible,
    openSettings,
  } = useUIStore();

  return (
    <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-0.5 flex-shrink-0">
      {icons.map(({ panel, icon: Icon, label }) => (
        <button
          key={panel}
          onClick={() => setActiveSidebarPanel(panel)}
          title={label}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 relative ${
            activeSidebarPanel === panel
              ? "text-sky-400 bg-sky-500/10"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          }`}
        >
          {activeSidebarPanel === panel && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r bg-sky-400" />
          )}
          <Icon size={20} />
        </button>
      ))}

      <div className="flex-1" />

      {/* Separator */}
      <div className="w-8 h-px bg-slate-800 my-1" />

      <button
        onClick={toggleWorkflowPanel}
        title="工作流面板"
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
          workflowPanelVisible
            ? "text-sky-400 bg-sky-500/10"
            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
        }`}
      >
        <WorkflowIcon size={20} />
      </button>

      <button
        onClick={openSettings}
        title="设置"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all duration-150"
      >
        <SettingsIcon size={20} />
      </button>
    </div>
  );
}
