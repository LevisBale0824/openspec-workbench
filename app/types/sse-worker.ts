// ---------------------------------------------------------------------------
// SharedWorker Message Types (placeholder for Phase 3)
// ---------------------------------------------------------------------------

export type TabToWorkerMessage =
  | { type: "connect"; baseUrl: string; authorization?: string; errorMessages?: Record<string, string> }
  | { type: "disconnect" };

export type WorkerToTabMessage =
  | { type: "packet"; packet: import("./sse").SsePacket }
  | { type: "connection.open" }
  | { type: "connection.reconnected" }
  | { type: "connection.error"; message: string; statusCode?: number };
