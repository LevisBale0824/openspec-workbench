// ---------------------------------------------------------------------------
// Session Routes
// ---------------------------------------------------------------------------
// REST API for session management compatible with OpenCode Server.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { createSession, listSessions, getSession, deleteSession, updateSessionStatus } from "../services/sessionStore.js";
import { broadcastEvent } from "../services/sseManager.js";

export async function sessionRoutes(server: FastifyInstance) {
  // List sessions
  server.get("/", async (request) => {
    const query = request.query as { directory?: string };
    const sessions = listSessions();
    if (query.directory) {
      return sessions.filter((s) => s.directory === query.directory);
    }
    return sessions;
  });

  // Create session
  server.post("/", async (request) => {
    const body = request.body as { agent?: string; directory?: string } | undefined;
    const agent = body?.agent ?? "claude-code";
    const directory = body?.directory ?? process.cwd();
    const session = createSession(agent, directory);

    // Broadcast session.created
    broadcastEvent({
      directory: session.directory,
      payload: {
        type: "session.created",
        properties: {
          info: {
            id: session.id,
            title: `Session ${session.id}`,
            directory: session.directory,
            status: "idle",
            time: {
              created: Math.floor(session.createdAt / 1000),
              updated: Math.floor(session.updatedAt / 1000),
            },
          },
        },
      },
    });

    return session;
  });

  // Get session
  server.get("/:sessionId", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getSession(sessionId);
    if (!session) return { error: "Session not found" };
    return session;
  });

  // Delete session
  server.delete("/:sessionId", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = getSession(sessionId);
    if (!session) return { error: "Session not found" };
    deleteSession(sessionId);

    broadcastEvent({
      directory: session.directory,
      payload: {
        type: "session.deleted",
        properties: { info: { id: sessionId } },
      },
    });

    return { ok: true };
  });

  // Abort session
  server.post("/:sessionId/abort", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    updateSessionStatus(sessionId, "idle");

    broadcastEvent({
      directory: getSession(sessionId)?.directory ?? "",
      payload: {
        type: "session.status",
        properties: { sessionID: sessionId, status: { type: "idle" } },
      },
    });

    return { ok: true };
  });
}
