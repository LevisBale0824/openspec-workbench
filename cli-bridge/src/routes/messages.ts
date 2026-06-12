// ---------------------------------------------------------------------------
// Message Routes
// ---------------------------------------------------------------------------
// REST API for sending prompts and retrieving messages.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { getSession, addMessage, updateSessionStatus } from "../services/sessionStore.js";
import { broadcastEvent } from "../services/sseManager.js";
import { spawnCliAgent } from "../services/agentRunner.js";

export async function messageRoutes(server: FastifyInstance) {
  // List messages for a session
  server.get("/:sessionId/message", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getSession(sessionId);
    if (!session) return { error: "Session not found" };
    return session.messages;
  });

  // Send prompt (async — starts CLI agent in background)
  server.post("/:sessionId/prompt_async", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getSession(sessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }

    const body = request.body as {
      agent?: string;
      parts?: Array<Record<string, unknown>>;
      directory?: string;
    };

    // Extract text from parts
    let promptText = "";
    if (Array.isArray(body?.parts)) {
      for (const part of body.parts) {
        if (part.type === "text" && typeof part.text === "string") {
          promptText += part.text;
        }
      }
    }

    if (!promptText.trim()) {
      reply.code(400);
      return { error: "Empty prompt" };
    }

    // Add user message
    const userMsg = addMessage(sessionId, "user", promptText);
    if (userMsg) {
      broadcastEvent({
        directory: session.directory,
        payload: {
          type: "message.updated",
          properties: {
            info: {
              id: userMsg.id,
              sessionID: sessionId,
              role: "user",
              content: promptText,
            },
          },
        },
      });
    }

    // Update status to busy
    updateSessionStatus(sessionId, "busy");
    broadcastEvent({
      directory: session.directory,
      payload: {
        type: "session.status",
        properties: { sessionID: sessionId, status: { type: "busy" } },
      },
    });

    // Spawn CLI agent in background (non-blocking)
    spawnCliAgent(sessionId, session.agent, session.directory, promptText).catch((err) => {
      console.error(`[AgentRunner] Fatal error for session ${sessionId}:`, err);
      updateSessionStatus(sessionId, "error");
    });

    reply.code(202);
    return { ok: true, sessionId };
  });
}
