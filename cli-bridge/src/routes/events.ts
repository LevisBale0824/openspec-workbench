// ---------------------------------------------------------------------------
// SSE Events Route
// ---------------------------------------------------------------------------
// Establishes SSE connection for real-time event streaming.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { registerSseClient } from "../services/sseManager.js";

export async function eventRoutes(server: FastifyInstance) {
  server.get("/event", async (request, reply) => {
    registerSseClient(reply);
    // Keep the connection alive — don't call reply.send()
    return reply;
  });
}
