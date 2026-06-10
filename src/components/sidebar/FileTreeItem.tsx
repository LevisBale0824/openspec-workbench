import { useProjectStore, FileTreeNode } from "../../stores/project";
import { useEditorStore } from "../../stores/editor";

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
}

const iconMap: Record<string, string> = {
  ts: "🟨", tsx: "⚛️", js: "🟨", jsx: "⚛️",
  rs: "🦀", py: "🐍", go: "🔵", java: "☕",
  json: "📋", toml: "📋", yaml: "📋", yml: "📋",
  md: "📝", css: "🎨", html: "🌐", svg: "🖼️",
  sql: "🗄️", sh: "⚙️", bat: "⚙️",
};

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return iconMap[ext] || "📄";
}

export function FileTreeItem({ node, depth }: FileTreeItemProps) {
  const { toggleDir } = useProjectStore();
  const { openFile } = useEditorStore();

  const handleClick = () => {
    if (node.isDir) {
      toggleDir(node.path);
    } else {
      openFile(node.path);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-[2px] cursor-pointer hover:bg-slate-800/70 text-xs group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Chevron for directories */}
        {node.isDir ? (
          <span className={`text-[10px] text-slate-500 transition-transform w-3 text-center ${node.expanded ? "rotate-90" : ""}`}>
            ▶
          </span>
        ) : (
          <span className="w-3" />
        )}

        {/* Icon */}
        <span className="text-xs flex-shrink-0">
          {node.isDir ? (node.expanded ? "📂" : "📁") : getFileIcon(node.name)}
        </span>

        {/* Name */}
        <span className="truncate text-slate-300 group-hover:text-white">
          {node.name}
        </span>
      </div>

      {/* Children */}
      {node.isDir && node.expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
