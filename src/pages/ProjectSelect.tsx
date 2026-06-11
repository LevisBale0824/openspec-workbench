import { useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../stores/project";
import { useUIStore, RecentProject } from "../stores/ui";
import { FolderIcon } from "../components/common/Icons";

interface ProjectSelectProps {
  onProjectSelected: () => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

function RecentProjectCard({
  project,
  onClick,
  onRemove,
}: {
  project: RecentProject;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-800
                 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700
                 transition-all duration-150 text-left w-full"
    >
      <span className="text-slate-500 group-hover:text-sky-400 transition-colors flex-shrink-0">
        <FolderIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-300 group-hover:text-white truncate transition-colors">
          {project.name}
        </p>
        <p className="text-[11px] text-slate-600 truncate">{project.path}</p>
      </div>
      <span className="text-[11px] text-slate-600 flex-shrink-0">{formatTime(project.openedAt)}</span>
      <span
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded text-slate-700
                   hover:text-slate-400 hover:bg-slate-700 opacity-0 group-hover:opacity-100
                   transition-all flex-shrink-0"
        title="移除"
      >
        ×
      </span>
    </button>
  );
}

export function ProjectSelect({ onProjectSelected }: ProjectSelectProps) {
  const { setProject } = useProjectStore();
  const { recentProjects, addRecentProject, removeRecentProject, loadRecentProjects } =
    useUIStore();

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  const recentList = useMemo(() => recentProjects, [recentProjects]);

  const handleOpen = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择项目目录",
    });
    if (selected && typeof selected === "string") {
      setProject(selected);
      addRecentProject(selected);
      onProjectSelected();
    }
  };

  const handleRecentClick = async (projectPath: string) => {
    setProject(projectPath);
    addRecentProject(projectPath);
    onProjectSelected();
  };

  const handleRemoveRecent = (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation();
    removeRecentProject(projectPath);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 select-none">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(148 163 184) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg px-6">
        {/* Hero Card */}
        <div className="relative rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl shadow-black/50">
          {/* Gradient top accent */}
          <div className="h-0.5 bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400" />

          <div className="p-8 pb-6 text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 mb-5 shadow-lg shadow-sky-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="8" y="14" width="7" height="7" rx="1" />
                <path d="M6.5 10v3.5H11" />
                <path d="M17.5 10v3.5H15" />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">
              OpenSpec Workbench
            </h1>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">
              AI-powered specification-driven development.
              <br />
              Explore &rarr; Propose &rarr; Apply &rarr; Archive 工作流自动化
            </p>

            {/* Primary Action */}
            <button
              onClick={handleOpen}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500
                         text-white rounded-xl font-medium text-sm shadow-lg shadow-sky-500/25
                         hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98]
                         transition-all duration-150"
            >
              <FolderIcon size={16} />
              打开项目目录
              <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/15 text-[11px] text-white/70 font-mono">
                Ctrl+O
              </kbd>
            </button>
          </div>
        </div>

        {/* Recent Projects */}
        {recentList.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
              最近打开
            </h2>
            <div className="space-y-1">
              {recentList.map((p) => (
                <RecentProjectCard
                  key={p.path}
                  project={p}
                  onClick={() => handleRecentClick(p.path)}
                  onRemove={(e) => handleRemoveRecent(e, p.path)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Keyboard Hints Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-600">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[10px]">
              Ctrl+O
            </kbd>
            {" "}打开
          </span>
          <span className="text-slate-800">|</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[10px]">
              Ctrl+,
            </kbd>
            {" "}设置
          </span>
        </div>
      </div>
    </div>
  );
}
