import { useEffect, useRef, useCallback } from "react";
import { OpenFile, useEditorStore } from "../../stores/editor";

export function CodeEditor({ file }: { file: OpenFile }) {
  const { updateContent, saveFile } = useEditorStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineCount = file.content.split("\n").length;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateContent(file.path, e.target.value);
    },
    [file.path, updateContent],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile(file.path);
        return;
      }
      // Tab inserts 2 spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          file.content.substring(0, start) + "  " + file.content.substring(end);
        updateContent(file.path, newContent);
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [file.path, file.content, saveFile, updateContent],
  );

  // Sync line numbers scroll with textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.addEventListener("scroll", handleScroll);
    return () => textarea.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="h-full flex bg-slate-950">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="py-3 pr-2 pl-4 text-right text-[11px] text-slate-600 font-mono leading-[1.6] overflow-hidden select-none flex-shrink-0 bg-slate-950"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={file.content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-slate-950 text-slate-300 font-mono text-xs leading-[1.6] p-3 resize-none outline-none border-none"
        spellCheck={false}
      />
    </div>
  );
}
