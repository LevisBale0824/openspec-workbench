// ---------------------------------------------------------------------------
// Session Store
// ---------------------------------------------------------------------------
// In-memory session storage for the CLI Bridge.
// ---------------------------------------------------------------------------

export type BridgeSession = {
  id: string;
  agent: string;
  directory: string;
  status: "idle" | "busy" | "error";
  createdAt: number;
  updatedAt: number;
  messages: BridgeMessage[];
};

export type BridgeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const sessions = new Map<string, BridgeSession>();

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `bridge-${idCounter}-${Date.now()}`;
}

export function createSession(agent: string, directory: string): BridgeSession {
  const now = Date.now();
  const session: BridgeSession = {
    id: nextId(),
    agent,
    directory,
    status: "idle",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): BridgeSession | undefined {
  return sessions.get(id);
}

export function listSessions(): BridgeSession[] {
  return [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updateSessionStatus(id: string, status: BridgeSession["status"]): void {
  const session = sessions.get(id);
  if (session) {
    session.status = status;
    session.updatedAt = Date.now();
  }
}

export function addMessage(sessionId: string, role: BridgeMessage["role"], content: string): BridgeMessage | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const msg: BridgeMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
  session.messages.push(msg);
  session.updatedAt = Date.now();
  return msg;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}
