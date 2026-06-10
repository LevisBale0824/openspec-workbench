import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../stores/project";

interface ProjectSelectProps {
  onProjectSelected: () => void;
}

export function ProjectSelect({ onProjectSelected }: ProjectSelectProps) {
  const { setProject } = useProjectStore();

  const handleOpen = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择项目目录",
    });
    if (selected && typeof selected === "string") {
      setProject(selected);
      onProjectSelected();
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-sky-400 mb-2">
          OpenSpec Workbench
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          选择一个项目目录开始工作
        </p>
        <button
          onClick={handleOpen}
          className="px-8 py-3 bg-gradient-to-r from-sky-400 to-indigo-400 text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
        >
          📂 打开项目目录
        </button>
      </div>
    </div>
  );
}
