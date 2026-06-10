import { useUIStore } from "../../stores/ui";
import { useProjectStore } from "../../stores/project";
import { FileExplorer } from "../sidebar/FileExplorer";

export function Sidebar() {
  const { activeSidebarPanel } = useUIStore();
  const { projectPath } = useProjectStore();

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        请先选择项目
      </div>
    );
  }

  if (activeSidebarPanel === "search") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">搜索</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs">
          搜索功能开发中...
        </div>
      </div>
    );
  }

  // Default: file-explorer
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">资源管理器</h3>
        <span className="text-[10px] text-slate-600">
          {projectPath.split(/[/\\]/).pop()}
        </span>
      </div>
      <FileExplorer />
    </div>
  );
}
