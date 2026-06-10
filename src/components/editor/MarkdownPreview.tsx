import { OpenFile, useEditorStore } from "../../stores/editor";
import { MarkdownViewer } from "../common/MarkdownViewer";

export function MarkdownPreview({ file }: { file: OpenFile }) {
  const { saveFile } = useEditorStore();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveFile(file.path);
    }
  };

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <span className="text-[10px] text-slate-500">Markdown</span>
        {file.isDirty && <span className="text-[10px] text-sky-400">已修改</span>}
      </div>
      {/* Preview */}
      <div className="flex-1 overflow-y-auto p-4">
        <MarkdownViewer content={file.content} />
      </div>
    </div>
  );
}
