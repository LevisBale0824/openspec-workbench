// ---------------------------------------------------------------------------
// Streaming Delta Accumulator
// ---------------------------------------------------------------------------
// Accumulates message.part.delta SSE events into full message parts.
// Uses a module-level Map so the state persists across component instances.
// Ported from opencode-visualizer-cn/app/composables/useDeltaAccumulator.ts
// ---------------------------------------------------------------------------

import type {
  MessageInfo,
  MessagePart,
  MessagePartDeltaPacket,
  MessagePartUpdatedPacket,
  MessageUpdatedPacket,
} from "../types/sse";

type GlobalEvents = {
  on(event: string, listener: (payload: unknown) => void): () => void;
};

export type AccumulatedMessage = {
  info: MessageInfo;
  parts: Map<string, MessagePart>;
};

// Module-level singleton store
const messages = new Map<string, AccumulatedMessage>();

function isComplete(info: MessageInfo): boolean {
  if (info.role !== "assistant") return true;
  if (info.error) return true;
  if (info.time.completed !== undefined) return true;
  if (info.finish) return true;
  return false;
}

export function useDeltaAccumulator() {
  function listen(ge: GlobalEvents): () => void {
    const offs: Array<() => void> = [];

    offs.push(
      ge.on("message.updated", (packet: unknown) => {
        const { info } = packet as MessageUpdatedPacket;
        if (isComplete(info)) {
          messages.delete(info.id);
          return;
        }
        const entry = messages.get(info.id);
        if (entry) {
          entry.info = info;
        } else {
          messages.set(info.id, { info, parts: new Map() });
        }
      }),
    );

    offs.push(
      ge.on("message.part.updated", (packet: unknown) => {
        const { part } = packet as MessagePartUpdatedPacket;
        const entry = messages.get(part.messageID);
        if (!entry) return;
        entry.parts.set(part.id, { ...part });
      }),
    );

    offs.push(
      ge.on("message.part.delta", (packet: unknown) => {
        const delta = packet as MessagePartDeltaPacket;
        const entry = messages.get(delta.messageID);
        if (!entry) return;
        const part = entry.parts.get(delta.partID);
        if (!part) return;
        const field = delta.field as keyof typeof part;
        if (field in part && typeof part[field] === "string") {
          (part[field] as string) += delta.delta;
        } else {
          (part as Record<string, unknown>)[field] = delta.delta;
        }
      }),
    );

    offs.push(
      ge.on("connection.reconnected", () => clear()),
    );

    return () => {
      for (const off of offs) off();
    };
  }

  function getMessage(messageID: string): AccumulatedMessage | undefined {
    return messages.get(messageID);
  }

  function clear(): void {
    messages.clear();
  }

  return { listen, getMessage, clear };
}
