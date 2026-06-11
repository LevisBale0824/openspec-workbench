import { useEditorStore } from "../../stores/editor";
import { CloseIcon, DotIcon } from "../common/Icons";

export function EditorTabBar() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();

  return (
    <div className="flex bg-slate-900 border-b border-slate-800 overflow-x-auto flex-shrink-0">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-slate-800 text-xs min-w-0 flex-shrink-0 select-none transition-colors duration-100 ${
              isActive
                ? "bg-slate-950 text-slate-200 border-t-2 border-t-sky-400"
                : "bg-slate-900 text-slate-500 hover:text-slate-300 border-t-2 border-t-transparent"
            }`}
          >
            <span className="truncate max-w-[140px]">{file.name}</span>
            {file.isDirty && !isActive && (
              <DotIcon size={8} className="text-sky-400 flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={`w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-all flex-shrink-0 ${
                !isActive && !file.isDirty ? "opacity-0 group-hover:opacity-100" : ""
              }`}
            >
              <CloseIcon size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
