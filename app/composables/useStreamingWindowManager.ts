// ---------------------------------------------------------------------------
// Streaming Window Manager
// ---------------------------------------------------------------------------
// Bridges SSE events to floating window lifecycle.
// Listens to tool call events (message.part.updated/delta) and automatically
// creates, updates, and closes floating windows for tool output.
// ---------------------------------------------------------------------------

import { markRaw, type Component } from "vue";
import { useFloatingWindows } from "./useFloatingWindows";
import type { SessionScope } from "./useGlobalEvents";
import type {
  MessagePartUpdatedPacket,
  MessagePartDeltaPacket,
  ToolPart,
  TextPart,
  ReasoningPart,
} from "../types/sse";

import ReadVue from "../components/ToolWindow/Read.vue";
import EditVue from "../components/ToolWindow/Edit.vue";
import BashVue from "../components/ToolWindow/Bash.vue";
import GrepVue from "../components/ToolWindow/Grep.vue";
import DefaultVue from "../components/ToolWindow/Default.vue";
import ReasoningVue from "../components/ToolWindow/Reasoning.vue";

import {
  guessLanguageFromPath,
  toolColor,
  formatReadLikeToolTitle,
} from "../components/ToolWindow/utils";
import { getFloatingWindowColor } from "../utils/floatingWindowTheme";

type StreamingWindowEntry = {
  key: string;
  sessionId: string;
  messageId: string;
  partId: string;
};

const CLOSE_DELAY_MS = 2_000;

// Tool name to component mapping
function resolveToolComponent(toolName: string): Component {
  switch (toolName) {
    case "read":
    case "list":
      return markRaw(ReadVue);
    case "edit":
    case "multiedit":
    case "write":
    case "apply_patch":
      return markRaw(EditVue);
    case "bash":
    case "shell":
      return markRaw(BashVue);
    case "grep":
    case "glob":
      return markRaw(GrepVue);
    default:
      return markRaw(DefaultVue);
  }
}

function resolveToolVariant(
  toolName: string,
): "code" | "diff" | "message" | "term" | "plain" {
  switch (toolName) {
    case "edit":
    case "multiedit":
    case "write":
    case "apply_patch":
      return "diff";
    case "bash":
    case "shell":
      return "term";
    case "grep":
    case "glob":
      return "code";
    default:
      return "code";
  }
}

export function useStreamingWindowManager() {
  const fw = useFloatingWindows();

  // Track active streaming windows by session
  const activeEntries = new Map<string, StreamingWindowEntry[]>();

  function getSessionEntries(sessionId: string): StreamingWindowEntry[] {
    let entries = activeEntries.get(sessionId);
    if (!entries) {
      entries = [];
      activeEntries.set(sessionId, entries);
    }
    return entries;
  }

  function makeWindowKey(
    sessionId: string,
    _messageId: string,
    partId: string,
  ): string {
    return `tool:${sessionId.slice(0, 8)}:${partId}`;
  }

  function subscribe(scope: SessionScope): () => void {
    const offs: Array<() => void> = [];
    const sessionId = "default";

    // Handle tool part updates
    offs.push(
      scope.on("message.part.updated", (packet: unknown) => {
        const { part } = packet as MessagePartUpdatedPacket;
        if (part.type !== "tool") return;

        const toolPart = part as ToolPart;
        const toolName = toolPart.tool;
        const key = makeWindowKey(sessionId, part.messageID, part.id);
        const component = resolveToolComponent(toolName);
        const variant = resolveToolVariant(toolName);
        const color =
          getFloatingWindowColor(key) ?? toolColor(toolName);

        const state = toolPart.state;

        // Extract title from state (only Running/Completed/Error have title)
        const title =
          ("title" in state ? state.title : undefined) ??
          formatReadLikeToolTitle(state.input) ??
          toolName;

        const lang = guessLanguageFromPath(
          state.input?.filePath as string | undefined,
        );

        if (state.status === "pending" || state.status === "running") {
          // Tool started or still running
          const content =
            state.status === "running"
              ? (state.metadata?.output as string) ?? ""
              : "";

          fw.open(key, {
            component,
            props: {
              html: content,
              command: toolName === "bash" ? (state.input?.command as string) : undefined,
            },
            content,
            lang,
            variant,
            title: `${toolName}: ${title}`,
            color,
            status: "running",
            closable: false,
            resizable: true,
            scroll: "follow",
            expiry: 1000 * 60 * 10,
          });

          const entries = getSessionEntries(sessionId);
          if (!entries.find((e) => e.key === key)) {
            entries.push({
              key,
              sessionId,
              messageId: part.messageID,
              partId: part.id,
            });
          }
        } else if (state.status === "completed") {
          // Tool completed
          const output = state.output ?? "";

          fw.open(key, {
            content: output,
            lang,
            variant,
            status: "completed",
            closable: true,
          });

          // Auto-close after delay
          setTimeout(() => {
            fw.close(key);
          }, CLOSE_DELAY_MS);
        } else if (state.status === "error") {
          fw.open(key, {
            content: state.error,
            lang: "text",
            variant: "plain",
            status: "error",
            closable: true,
          });

          setTimeout(() => {
            fw.close(key);
          }, CLOSE_DELAY_MS);
        }
      }),
    );

    // Handle streaming deltas for tool output
    offs.push(
      scope.on("message.part.delta", (packet: unknown) => {
        const { partID, delta } = packet as MessagePartDeltaPacket;
        if (!delta) return;

        // Find existing window for this part
        const entries = getSessionEntries(sessionId);
        const entry = entries.find((e) => e.partId === partID);
        if (!entry) return;

        const text = typeof delta === "string" ? delta : "";
        fw.appendContent(entry.key, text);
      }),
    );

    // Handle reasoning parts
    offs.push(
      scope.on("message.part.updated", (packet: unknown) => {
        const { part } = packet as MessagePartUpdatedPacket;
        if (part.type !== "reasoning") return;

        const reasoningPart = part as ReasoningPart;
        if (!reasoningPart.text?.trim()) return;

        const key = `reasoning:${sessionId.slice(0, 8)}:${part.id}`;
        if (!fw.has(key)) {
          fw.open(key, {
            component: markRaw(ReasoningVue),
            props: {
              entries: [{ id: part.id, text: reasoningPart.text }],
            },
            title: "Reasoning",
            color: "#8b5cf6",
            status: "running",
            closable: false,
            scroll: "follow",
            variant: "message",
            expiry: 1000 * 60 * 10,
          });
        }
      }),
    );

    return () => {
      offs.forEach((off) => off());
    };
  }

  function clearSession(sessionId: string): void {
    const entries = activeEntries.get(sessionId);
    if (!entries) return;

    for (const entry of entries) {
      fw.close(entry.key);
    }
    activeEntries.delete(sessionId);
  }

  return {
    subscribe,
    clearSession,
  };
}
