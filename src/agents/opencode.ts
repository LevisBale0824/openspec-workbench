import { AgentAdapter, AgentRequest, AgentResponse, ChatMessage, AgentConfig } from "./types";

export class OpenCodeAdapter implements AgentAdapter {
  name = "opencode";
  type: "sdk" = "sdk";
  private serverUrl: string;
  private configPath: string;

  constructor(options?: { serverUrl?: string; configPath?: string }) {
    this.serverUrl = options?.serverUrl || "http://localhost:3000";
    this.configPath = options?.configPath || ".opencode/oh-my-opencode.json";
  }

  async start(): Promise<void> {
    // OpenCode server may already be running
  }

  async stop(): Promise<void> {
    // No-op: we don't own the OpenCode server lifecycle
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/health`);
      return res.ok;
    } catch { return false; }
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    try {
      const res = await fetch(`${this.serverUrl}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.prompt, projectPath: req.projectPath, stream: false }),
      });
      const data = await res.json();
      return { content: data.content || data.output || "", success: res.ok };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    try {
      const res = await fetch(`${this.serverUrl}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.prompt, projectPath: req.projectPath, stream: true }),
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;
            yield data;
          }
        }
      }
    } catch (err) { yield `Error: ${err}`; }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({ prompt: lastMessage.content, projectPath: "" });
  }

  async getConfig(): Promise<AgentConfig> {
    try {
      const res = await fetch(`${this.serverUrl}/api/config`);
      return await res.json();
    } catch { return {}; }
  }
}
