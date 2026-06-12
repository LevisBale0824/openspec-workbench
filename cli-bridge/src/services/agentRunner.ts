// ---------------------------------------------------------------------------
// CLI Agent Runner
// ---------------------------------------------------------------------------
// Spawns CLI agents (Claude Code, Codex) as child processes and streams
// their output as SSE events. Ported from Python agents/.
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "child_process";
import { getSession, addMessage, updateSessionStatus } from "./sessionStore.js";
import { broadcastEvent } from "./sseManager.js";
import { parseEvent } from "./eventParser.js";

const runningProcesses = new Map<string, ChildProcess>();

export async function spawnCliAgent(
  sessionId: string,
  agent: string,
  directory: string,
  prompt: string,
): Promise<void> {
  const session = getSession(sessionId);
  if (!session) return;

  // Build CLI command based on agent type
  const { command, args } = buildCliCommand(agent, prompt, directory);

  // Create assistant message placeholder
  const assistantId = `msg-assistant-${Date.now()}`;
  let fullText = "";

  broadcastEvent({
    directory: session.directory,
    payload: {
      type: "message.updated",
      properties: {
        info: {
          id: assistantId,
          sessionID: sessionId,
          role: "assistant",
          status: "streaming",
        },
      },
    },
  });

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: directory,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    runningProcesses.set(sessionId, proc);

    // Send prompt via stdin for interactive agents
    if (agent === "opencode") {
      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    let buffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        processCliLine(sessionId, session.directory, assistantId, line, agent);
      }

      // Update assistant content
      broadcastEvent({
        directory: session.directory,
        payload: {
          type: "message.part.updated",
          properties: {
            part: {
              id: `part-text-${assistantId}`,
              sessionID: sessionId,
              messageID: assistantId,
              type: "text",
              text: fullText,
            },
          },
        },
      });
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      console.error(`[AgentRunner:${agent}] stderr:`, chunk.toString("utf-8"));
    });

    proc.on("close", (code) => {
      runningProcesses.delete(sessionId);

      // Final message update
      broadcastEvent({
        directory: session.directory,
        payload: {
          type: "message.updated",
          properties: {
            info: {
              id: assistantId,
              sessionID: sessionId,
              role: "assistant",
              content: fullText,
              status: code === 0 ? "complete" : "error",
              finish: code === 0 ? "stop" : "error",
            },
          },
        },
      });

      addMessage(sessionId, "assistant", fullText);
      updateSessionStatus(sessionId, "idle");

      broadcastEvent({
        directory: session.directory,
        payload: {
          type: "session.status",
          properties: { sessionID: sessionId, status: { type: "idle" } },
        },
      });

      resolve();
    });

    proc.on("error", (err) => {
      runningProcesses.delete(sessionId);
      updateSessionStatus(sessionId, "error");
      reject(err);
    });
  });
}

function processCliLine(
  sessionId: string,
  directory: string,
  assistantId: string,
  line: string,
  agent: string,
): void {
  // Try parsing as JSON first (Claude Code / Codex)
  try {
    const event = JSON.parse(line);
    const parsed = parseEvent(event);

    if (parsed.displayText) {
      // Accumulate text via broadcast
      broadcastEvent({
        directory,
        payload: {
          type: "message.part.delta",
          properties: {
            sessionID: sessionId,
            messageID: assistantId,
            partID: `part-text-${assistantId}`,
            field: "text",
            delta: parsed.displayText,
          },
        },
      });
    }
    return;
  } catch {
    // Not JSON — treat as plain text
  }

  // Plain text output (fallback for any CLI)
  broadcastEvent({
    directory,
    payload: {
      type: "message.part.delta",
      properties: {
        sessionID: sessionId,
        messageID: assistantId,
        partID: `part-text-${assistantId}`,
        field: "text",
        delta: line + "\n",
      },
    },
  });
}

function buildCliCommand(
  agent: string,
  prompt: string,
  _directory: string,
): { command: string; args: string[] } {
  switch (agent) {
    case "claude-code":
      return {
        command: "claude",
        args: ["--output-format", "stream-json", "-p", prompt],
      };
    case "codex":
      return {
        command: "codex",
        args: ["-q", "--full-auto", prompt],
      };
    case "opencode":
      return {
        command: "opencode",
        args: ["chat"],
      };
    default:
      return {
        command: agent,
        args: [prompt],
      };
  }
}

export function abortAgent(sessionId: string): boolean {
  const proc = runningProcesses.get(sessionId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  runningProcesses.delete(sessionId);
  return true;
}
