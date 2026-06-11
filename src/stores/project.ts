import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ScannedArtifact {
  id: string;
  fileName: string;
  filePath: string;
  content: string;
  lastModified: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  expanded: boolean;
  children: FileTreeNode[] | null; // null = not loaded yet
}

interface ProjectState {
  projectPath: string;
  changeId: string;
  openspecDir: string;
  fileTree: FileTreeNode[];
}

interface ProjectActions {
  setProject: (path: string) => void;
  scanArtifacts: () => Promise<ScannedArtifact[]>;
  loadFileTree: () => Promise<void>;
  toggleDir: (path: string) => Promise<void>;
}

export function generateSessionId(projectPath: string): string {
  let hash = 0;
  for (let i = 0; i < projectPath.length; i++) {
    hash = ((hash << 5) - hash) + projectPath.charCodeAt(i);
    hash |= 0;
  }
  return `openspec-${Math.abs(hash).toString(36)}`;
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  projectPath: "",
  changeId: "",
  openspecDir: "",
  fileTree: [],

  setProject: (path) => {
    set({ projectPath: path, openspecDir: `${path}/openspec` });
  },

  scanArtifacts: async () => {
    const { openspecDir, changeId } = get();
    const dirPath = `${openspecDir}/changes/${changeId}`;
    const result = await invoke<{ name: string; path: string; is_dir: boolean }[]>("scan_artifacts", { dirPath });
    const artifacts = result.map((r) => ({
      id: r.path, fileName: r.name, filePath: r.path, content: "", lastModified: Date.now(),
    }));
    return artifacts;
  },

  loadFileTree: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    const entries = await invoke<{ name: string; path: string; is_dir: boolean }[]>("list_directory", { dirPath: projectPath });
    const tree: FileTreeNode[] = entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDir: e.is_dir,
      expanded: false,
      children: e.is_dir ? null : undefined as never,
    }));
    set({ fileTree: tree });
  },

  toggleDir: async (path) => {
    const { fileTree } = get();

    const toggle = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (node.path === path && node.isDir) {
          if (!node.children && !node.expanded) {
            // Load children
            const entries = await invoke<{ name: string; path: string; is_dir: boolean }[]>("list_directory", { dirPath: path });
            const children: FileTreeNode[] = entries.map((e) => ({
              name: e.name,
              path: e.path,
              isDir: e.is_dir,
              expanded: false,
              children: e.is_dir ? null : undefined as never,
            }));
            return { ...node, expanded: true, children };
          }
          return { ...node, expanded: !node.expanded };
        }
        if (node.children) {
          return { ...node, children: await toggle(node.children) };
        }
        return node;
      }));
    };

    const newTree = await toggle(fileTree);
    set({ fileTree: newTree });
  },
}));
