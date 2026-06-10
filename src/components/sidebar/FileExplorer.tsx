import { useEffect } from "react";
import { useProjectStore } from "../../stores/project";
import { FileTreeItem } from "./FileTreeItem";

export function FileExplorer() {
  const { fileTree, loadFileTree } = useProjectStore();

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  if (fileTree.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-xs">
        空目录
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {fileTree.map((node) => (
        <FileTreeItem key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
