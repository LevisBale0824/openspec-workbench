import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { ChatMessage, Artifact } from "../agents/types";

export type StepName = "explore" | "propose" | "apply" | "archive";
export type StepPhase = "idle" | "input" | "executing" | "reviewing" | "done";

interface WorkflowState {
  currentStep: StepName;
  currentPhase: StepPhase;
  artifacts: Artifact[];
  reviewedArtifacts: Set<string>;
  chatHistory: ChatMessage[];
  streamOutput: string;
  sessionId: string;
  waitingForInput: boolean;
}

interface WorkflowActions {
  loadState: () => Promise<void>;
  setPhase: (phase: StepPhase) => Promise<void>;
  advanceStep: () => Promise<void>;
  resetWorkflow: () => Promise<void>;
  setArtifacts: (artifacts: Artifact[]) => void;
  markReviewed: (artifactId: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  appendStreamOutput: (chunk: string) => void;
  clearStreamOutput: () => void;
  isAllReviewed: () => boolean;
  setSessionId: (id: string) => void;
  setWaitingForInput: (waiting: boolean) => void;
}

export const STEP_ORDER: StepName[] = ["explore", "propose", "apply", "archive"];

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()((set, get) => ({
  currentStep: "explore",
  currentPhase: "idle",
  artifacts: [],
  reviewedArtifacts: new Set<string>(),
  chatHistory: [],
  streamOutput: "",
  sessionId: "",
  waitingForInput: false,

  loadState: async () => {
    const state = await invoke<{ current_step: StepName; current_phase: StepPhase }>("get_workflow_state");
    set({ currentStep: state.current_step, currentPhase: state.current_phase });
  },

  setPhase: async (phase) => {
    await invoke("set_phase", { phase });
    set({ currentPhase: phase });
  },

  advanceStep: async () => {
    const state = await invoke<{ current_step: StepName; current_phase: StepPhase }>("advance_step");
    set({
      currentStep: state.current_step,
      currentPhase: "idle",
      artifacts: [],
      reviewedArtifacts: new Set(),
      chatHistory: [],
      streamOutput: "",
    });
  },

  resetWorkflow: async () => {
    const state = await invoke<{ current_step: StepName; current_phase: StepPhase }>("reset_workflow");
    set({
      currentStep: state.current_step,
      currentPhase: "idle",
      artifacts: [],
      reviewedArtifacts: new Set(),
      chatHistory: [],
      streamOutput: "",
    });
  },

  setArtifacts: (artifacts) => set({ artifacts }),
  markReviewed: (id) => {
    const reviewed = new Set(get().reviewedArtifacts);
    reviewed.add(id);
    set({ reviewedArtifacts: reviewed });
  },
  addChatMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
  appendStreamOutput: (chunk) => set((s) => ({ streamOutput: s.streamOutput + chunk })),
  clearStreamOutput: () => set({ streamOutput: "" }),
  isAllReviewed: () => {
    const { artifacts, reviewedArtifacts } = get();
    return artifacts.length > 0 && artifacts.every((a) => reviewedArtifacts.has(a.id));
  },
  setSessionId: (id) => set({ sessionId: id }),
  setWaitingForInput: (waiting) => set({ waitingForInput: waiting }),
}));
