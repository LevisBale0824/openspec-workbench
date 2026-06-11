import { create } from "zustand";

export type SidebarPanel = "file-explorer" | "search" | null;

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
}

interface UIState {
  sidebarVisible: boolean;
  sidebarWidth: number;
  activeSidebarPanel: SidebarPanel;
  editorVisible: boolean;
  workflowPanelVisible: boolean;
  workflowPanelWidth: number;
  settingsModalOpen: boolean;
  recentProjects: RecentProject[];
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setActiveSidebarPanel: (panel: SidebarPanel) => void;
  toggleWorkflowPanel: () => void;
  setWorkflowPanelWidth: (w: number) => void;
  toggleEditor: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  addRecentProject: (path: string) => void;
  removeRecentProject: (path: string) => void;
  loadRecentProjects: () => void;
}

const RECENT_PROJECTS_KEY = "recent-projects";

function loadStoredProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    return parsed.filter((p) => p.path && p.name);
  } catch {
    return [];
  }
}

function saveStoredProjects(projects: RecentProject[]) {
  try {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, 10)));
  } catch {
    // localStorage may be unavailable
  }
}

export const useUIStore = create<UIState & UIActions>()((set, get) => ({
  sidebarVisible: true,
  sidebarWidth: 260,
  activeSidebarPanel: "file-explorer",
  editorVisible: true,
  workflowPanelVisible: true,
  workflowPanelWidth: 340,
  settingsModalOpen: false,
  recentProjects: [],

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(400, w)) }),
  setActiveSidebarPanel: (panel) => {
    const { activeSidebarPanel, sidebarVisible } = get();
    if (activeSidebarPanel === panel) {
      set({ sidebarVisible: !sidebarVisible });
    } else {
      set({ activeSidebarPanel: panel, sidebarVisible: true });
    }
  },
  toggleWorkflowPanel: () => set((s) => ({ workflowPanelVisible: !s.workflowPanelVisible })),
  setWorkflowPanelWidth: (w) => set({ workflowPanelWidth: Math.max(260, Math.min(500, w)) }),
  toggleEditor: () => {
    const { editorVisible } = get();
    set({ editorVisible: !editorVisible });
  },
  openSettings: () => set({ settingsModalOpen: true }),
  closeSettings: () => set({ settingsModalOpen: false }),

  addRecentProject: (path: string) => {
    const { recentProjects } = get();
    const name = path.split(/[/\\]/).pop() || path;
    const filtered = recentProjects.filter((p) => p.path !== path);
    const updated = [{ path, name, openedAt: Date.now() }, ...filtered].slice(0, 10);
    set({ recentProjects: updated });
    saveStoredProjects(updated);
  },

  removeRecentProject: (path: string) => {
    const updated = get().recentProjects.filter((p) => p.path !== path);
    set({ recentProjects: updated });
    saveStoredProjects(updated);
  },

  loadRecentProjects: () => {
    set({ recentProjects: loadStoredProjects() });
  },
}));
