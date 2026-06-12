// ---------------------------------------------------------------------------
// CLI Bridge Server — Fastify Entry Point
// ---------------------------------------------------------------------------
// A Node.js bridge server that wraps CLI agents (Claude Code, Codex) and
// normalizes their output into OpenCode Server-compatible REST API + SSE.
// ---------------------------------------------------------------------------

import Fastify from "fastify";
import { sessionRoutes } from "./routes/sessions.js";
import { messageRoutes } from "./routes/messages.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";

const PORT = parseInt(process.env.BRIDGE_PORT ?? "13285", 10);
const HOST = process.env.BRIDGE_HOST ?? "127.0.0.1";

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  // CORS for local dev
  server.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      reply.code(204).send();
    }
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(sessionRoutes, { prefix: "/session" });
  await server.register(messageRoutes, { prefix: "/session" });
  await server.register(eventRoutes, { prefix: "/global" });

  // Start
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`CLI Bridge listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
