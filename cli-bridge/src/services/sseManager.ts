// ---------------------------------------------------------------------------
// SSE Event Manager
// ---------------------------------------------------------------------------
// Manages Server-Sent Events connections and broadcasts events to all clients.
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from "fastify";

type SsePacket = {
  directory: string;
  payload: {
    type: string;
    properties: Record<string, unknown>;
  };
};

type SseClient = {
  reply: FastifyReply;
  connected: boolean;
};

const clients = new Set<SseClient>();

export function registerSseClient(reply: FastifyReply): void {
  const client: SseClient = { reply, connected: true };

  reply.raw.on("close", () => {
    client.connected = false;
    clients.delete(client);
  });

  // SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  clients.add(client);
}

export function broadcastEvent(packet: SsePacket): void {
  const data = `data: ${JSON.stringify(packet)}\n\n`;
  for (const client of clients) {
    if (!client.connected) continue;
    try {
      client.reply.raw.write(data);
    } catch {
      client.connected = false;
      clients.delete(client);
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
