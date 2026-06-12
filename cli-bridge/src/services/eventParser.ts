// ---------------------------------------------------------------------------
// Event Parser Service
// ---------------------------------------------------------------------------
// Parses JSON events from CLI agents into a normalized format.
// Ported from openspec-workbench-py/agents/event_parser.py
// ---------------------------------------------------------------------------

export type ParsedEvent = {
  displayText: string;
  isQuestion: boolean;
  eventType: string;
  sessionId?: string;
};

function isQuestionToolName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    /^(ask|question|ask_user|user_input|confirm|prompt)$/.test(lower) ||
    lower.includes("ask") ||
    lower.includes("question")
  );
}

export function parseEvent(event: Record<string, unknown>): ParsedEvent {
  const eventType = String(event.type ?? "");
  const sessionId = event.sessionID as string | undefined;

  switch (eventType) {
    case "step_start":
      return { displayText: "", isQuestion: false, eventType, sessionId };

    case "step_finish": {
      const part = event.part as Record<string, unknown> | undefined;
      const tokens = part?.tokens as Record<string, number> | undefined;
      if (tokens) {
        const cost = (part?.cost as number) ?? 0;
        return {
          displayText: `\n[done] tokens: ${tokens.total ?? 0} | cost: $${cost}`,
          isQuestion: false,
          eventType,
          sessionId,
        };
      }
      return { displayText: "", isQuestion: false, eventType, sessionId };
    }

    case "content_block_start": {
      const block = event.content_block as Record<string, unknown> | undefined;
      return {
        displayText: String(block?.text ?? ""),
        isQuestion: false,
        eventType,
        sessionId,
      };
    }

    case "content_block_delta": {
      const delta = event.delta as Record<string, unknown> | undefined;
      return {
        displayText: String(delta?.text ?? ""),
        isQuestion: false,
        eventType,
        sessionId,
      };
    }

    case "assistant":
    case "message": {
      const content = event.content;
      if (typeof content === "string") {
        return { displayText: content, isQuestion: false, eventType, sessionId };
      }
      if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const block of content) {
          const b = block as Record<string, unknown>;
          let text = String(b.text ?? "");
          if (!text && b.type === "text") text = String(b.value ?? "");
          parts.push(text);
        }
        return { displayText: parts.join(""), isQuestion: false, eventType, sessionId };
      }
      if (typeof event.message === "string") {
        return { displayText: event.message, isQuestion: false, eventType, sessionId };
      }
      return { displayText: "", isQuestion: false, eventType, sessionId };
    }

    case "text": {
      const part = event.part as Record<string, unknown> | undefined;
      const text = String(part?.text ?? event.text ?? "");
      return { displayText: text, isQuestion: false, eventType, sessionId };
    }

    case "tool_use":
    case "tool_call": {
      const func = event.function as Record<string, unknown> | undefined;
      const name = String(
        event.name ?? event.tool ?? func?.name ?? "?",
      );
      return {
        displayText: `\n[using ${name}]`,
        isQuestion: isQuestionToolName(name),
        eventType,
        sessionId,
      };
    }

    case "tool_result": {
      const result = event.content ?? event.result ?? "";
      const preview = typeof result === "string" ? result.slice(0, 300) : JSON.stringify(result).slice(0, 300);
      return {
        displayText: preview ? `\n[result] ${preview}` : "",
        isQuestion: false,
        eventType,
        sessionId,
      };
    }

    case "thinking":
    case "reasoning": {
      const thought = String(
        event.text ?? event.content ?? event.thinking ?? "",
      );
      if (thought) {
        return { displayText: `\n[thinking] ${thought}`, isQuestion: false, eventType, sessionId };
      }
      return { displayText: "", isQuestion: false, eventType, sessionId };
    }

    case "error": {
      const msg = String(event.message ?? event.error ?? "unknown");
      return { displayText: `\n[error] ${msg}`, isQuestion: false, eventType, sessionId };
    }

    default: {
      const delta = event.delta as Record<string, unknown> | undefined;
      const part = event.part as Record<string, unknown> | undefined;
      const text = event.text ?? event.content ?? event.message ?? delta?.text ?? part?.text;
      if (typeof text === "string" && text) {
        return { displayText: text, isQuestion: false, eventType, sessionId };
      }
      return { displayText: "", isQuestion: false, eventType, sessionId };
    }
  }
}
