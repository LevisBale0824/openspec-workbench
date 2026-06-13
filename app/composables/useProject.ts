// ---------------------------------------------------------------------------
// Project Store — shared state for opened project directory
// ---------------------------------------------------------------------------

import { reactive } from "vue";
import {
  isElectron,
  selectDirectory,
  readDirectory,
} from "../utils/electronBridge";
import type { DirEntry } from "../types/electron";

export type FileNode = {
  name: string;
  kind: "file" | "directory";
  path: string;
  handle?: FileSystemDirectoryHandle;
  children?: FileNode[];
  expanded?: boolean;
  loaded?: boolean;
};

type ProjectState = {
  rootHandle: FileSystemDirectoryHandle | null;
  directoryName: string;
  directoryPath: string;
  root: FileNode | null;
  loading: boolean;
  error: string;
};

const state = reactive<ProjectState>({
  rootHandle: null,
  directoryName: "",
  directoryPath: "",
  root: null,
  loading: false,
  error: "",
});

async function readDirectoryFromHandle(
  handle: FileSystemDirectoryHandle,
  parentPath: string,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for await (const [name, child] of handle.entries()) {
    const kind = child.kind as "file" | "directory";
    const path = parentPath ? `${parentPath}/${name}` : name;
    const node: FileNode = { name, kind, path };
    if (kind === "directory") {
      node.handle = child as FileSystemDirectoryHandle;
      node.children = [];
      node.expanded = false;
      node.loaded = false;
    }
    nodes.push(node);
  }
  // Sort: directories first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export function useProject() {
  async function openDirectoryHandle(handle: FileSystemDirectoryHandle) {
    state.rootHandle = handle;
    state.directoryName = handle.name;
    state.directoryPath = handle.name;
    state.loading = true;
    state.error = "";

    try {
      const children = await readDirectoryFromHandle(handle, "");
      state.root = {
        name: handle.name,
        kind: "directory",
        path: "",
        handle,
        children,
        expanded: true,
        loaded: true,
      };
    } catch (e) {
      console.error("[useProject] read error:", e);
      state.error = String(e);
    } finally {
      state.loading = false;
    }
  }

  async function toggleNode(node: FileNode) {
    if (node.kind !== "directory") return;

    // Web mode: expand via FileSystemDirectoryHandle
    if (node.handle) {
      if (!node.loaded) {
        const children = await readDirectoryFromHandle(node.handle, node.path);
        node.children = children;
        node.loaded = true;
      }
      node.expanded = !node.expanded;
      return;
    }

    // Electron mode: expand via IPC using absolute root + relative path
    if (isElectron() && state.directoryPath) {
      if (!node.loaded) {
        const entries = await readDirectory(state.directoryPath, node.path);
        node.children = (entries ?? []).map(entryToFileNode);
        node.loaded = true;
      }
      node.expanded = !node.expanded;
    }
  }

  function openDirectoryPath(path: string) {
    // In Electron, defer to the IPC-backed loader so the tree actually populates.
    if (isElectron()) {
      void openDirectoryPathElectron(path);
      return;
    }
    state.rootHandle = null;
    state.directoryName = path.split(/[/\\]/).pop() || path;
    state.directoryPath = path;
    state.root = null;
    state.loading = false;
    state.error = "";
  }

  function entryToFileNode(entry: DirEntry): FileNode {
    const node: FileNode = {
      name: entry.name,
      kind: entry.kind,
      path: entry.path,
    };
    if (entry.kind === "directory") {
      node.children = [];
      node.expanded = false;
      node.loaded = false;
    }
    return node;
  }

  async function openDirectoryPathElectron(absPath: string) {
    state.rootHandle = null;
    state.directoryName = absPath.split(/[/\\]/).pop() || absPath;
    state.directoryPath = absPath;
    state.loading = true;
    state.error = "";
    try {
      const entries = await readDirectory(absPath, "");
      const children = (entries ?? []).map(entryToFileNode);
      state.root = {
        name: state.directoryName,
        kind: "directory",
        path: "",
        children,
        expanded: true,
        loaded: true,
      };
    } catch (e) {
      console.error("[useProject] electron read error:", e);
      state.error = String(e);
    } finally {
      state.loading = false;
    }
  }

  function clearProject() {
    state.rootHandle = null;
    state.directoryName = "";
    state.directoryPath = "";
    state.root = null;
    state.loading = false;
    state.error = "";
  }

  async function openDirectoryNative(): Promise<boolean> {
    if (!isElectron()) return false;
    const dirPath = await selectDirectory();
    if (!dirPath) return false;
    await openDirectoryPathElectron(dirPath);
    return true;
  }

  return {
    state,
    openDirectoryHandle,
    openDirectoryNative,
    toggleNode,
    openDirectoryPath,
    clearProject,
  };
}
