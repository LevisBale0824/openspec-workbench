import { useEditorStore } from "../../stores/editor";

export function EditorTabBar() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();

  return (
    <div className="flex bg-slate-900 border-b border-slate-800 overflow-x-auto flex-shrink-0">
      {openFiles.map((file) => (
        <div
          key={file.path}
          onClick={() => setActiveFile(file.path)}
          className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-slate-800 text-xs min-w-0 flex-shrink-0 ${
            file.path === activeFilePath
              ? "bg-slate-950 text-slate-200 border-t-2 border-t-sky-400"
              : "bg-slate-900 text-slate-500 hover:text-slate-300 border-t-2 border-t-transparent"
          }`}
        >
          <span className="truncate max-w-[120px]">{file.name}</span>
          {file.isDirty && <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />}
          <button
            onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
            className="ml-1 text-slate-600 hover:text-slate-300 hover:bg-slate-700 rounded w-4 h-4 flex items-center justify-center flex-shrink-0"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
