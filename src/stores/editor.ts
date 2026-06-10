import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isMarkdown: boolean;
}

interface EditorState {
  openFiles: OpenFile[];
  activeFilePath: string | null;
}

interface EditorActions {
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
}

function isMarkdown(path: string): boolean {
  return path.endsWith(".md") || path.endsWith(".markdown");
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => ({
  openFiles: [],
  activeFilePath: null,

  openFile: async (path) => {
    const { openFiles } = get();
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }
    try {
      const content = await invoke<string>("read_file_content", { filePath: path });
      const file: OpenFile = {
        path,
        name: fileName(path),
        content,
        originalContent: content,
        isDirty: false,
        isMarkdown: isMarkdown(path),
      };
      set({ openFiles: [...openFiles, file], activeFilePath: path });
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  },

  closeFile: (path) => {
    const { openFiles, activeFilePath } = get();
    const remaining = openFiles.filter((f) => f.path !== path);
    let newActive = activeFilePath;
    if (activeFilePath === path) {
      const idx = openFiles.findIndex((f) => f.path === path);
      newActive = remaining.length > 0
        ? remaining[Math.min(idx, remaining.length - 1)].path
        : null;
    }
    set({ openFiles: remaining, activeFilePath: newActive });
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateContent: (path, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: f.originalContent !== content } : f
      ),
    }));
  },

  saveFile: async (path) => {
    const file = get().openFiles.find((f) => f.path === path);
    if (!file) return;
    try {
      await invoke("write_file_content", { filePath: path, content: file.content });
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, originalContent: f.content, isDirty: false } : f
        ),
      }));
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  },

  saveActiveFile: async () => {
    const { activeFilePath } = get();
    if (activeFilePath) {
      await get().saveFile(activeFilePath);
    }
  },
}));
