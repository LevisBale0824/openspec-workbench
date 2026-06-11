import { useProjectStore, FileTreeNode } from "../../stores/project";
import { useEditorStore } from "../../stores/editor";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FileIcon, CodeIcon, MarkdownIcon } from "../common/Icons";

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
}

function getFileIconComponent(name: string): typeof FileIcon {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "md" || ext === "mdx") return MarkdownIcon;
  if (["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "json", "toml", "yaml", "yml", "css", "html", "sql", "sh", "bat"].includes(ext)) return CodeIcon;
  return FileIcon;
}

function getFileIconColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "ts" || ext === "tsx") return "text-sky-400";
  if (ext === "js" || ext === "jsx") return "text-amber-400";
  if (ext === "rs") return "text-orange-400";
  if (ext === "py") return "text-blue-400";
  if (ext === "go") return "text-cyan-400";
  if (ext === "md") return "text-slate-400";
  if (ext === "json" || ext === "toml" || ext === "yaml" || ext === "yml") return "text-red-300";
  if (ext === "css") return "text-purple-400";
  if (ext === "html") return "text-orange-500";
  return "text-slate-500";
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

  const FileIconComponent = node.isDir ? FolderIcon : getFileIconComponent(node.name);
  const iconColor = node.isDir
    ? node.expanded ? "text-amber-300" : "text-amber-500"
    : getFileIconColor(node.name);

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-slate-800/60 text-xs group transition-colors"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={handleClick}
      >
        {/* Chevron */}
        {node.isDir ? (
          <span className="text-slate-600 flex-shrink-0">
            {node.expanded ? (
              <ChevronDownIcon size={10} />
            ) : (
              <ChevronRightIcon size={10} />
            )}
          </span>
        ) : (
          <span className="w-2.5 flex-shrink-0" />
        )}

        {/* File/Dir icon */}
        <span className={`flex-shrink-0 ${iconColor}`}>
          <FileIconComponent size={14} />
        </span>

        {/* Name */}
        <span className="truncate text-slate-400 group-hover:text-slate-200 transition-colors">
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
