import { create } from "zustand";

export type SidebarPanel = "file-explorer" | "search" | null;

interface UIState {
  sidebarVisible: boolean;
  sidebarWidth: number;
  activeSidebarPanel: SidebarPanel;
  workflowPanelVisible: boolean;
  workflowPanelWidth: number;
  settingsModalOpen: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setActiveSidebarPanel: (panel: SidebarPanel) => void;
  toggleWorkflowPanel: () => void;
  setWorkflowPanelWidth: (w: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useUIStore = create<UIState & UIActions>()((set, get) => ({
  sidebarVisible: true,
  sidebarWidth: 260,
  activeSidebarPanel: "file-explorer",
  workflowPanelVisible: true,
  workflowPanelWidth: 340,
  settingsModalOpen: false,

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
  openSettings: () => set({ settingsModalOpen: true }),
  closeSettings: () => set({ settingsModalOpen: false }),
}));
