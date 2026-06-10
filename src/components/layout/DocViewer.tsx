import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MarkdownViewer } from "../common/MarkdownViewer";

interface DocViewerProps {
  filePath: string | null;
}

export function DocViewer({ filePath }: DocViewerProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent("");
      return;
    }
    setLoading(true);
    invoke<string>("read_file_content", { filePath })
      .then((c) => setContent(c))
      .catch((e) => setContent(`Error reading file: ${e}`))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
        选择一个产物文件查看
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <MarkdownViewer content={content} />
    </div>
  );
}
