// ---------------------------------------------------------------------------
// Health Route
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";

export async function healthRoutes(server: FastifyInstance) {
  server.get("/global/health", async () => {
    return { healthy: true, version: "1.0.0" };
  });
}
