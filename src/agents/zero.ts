import {
  AgentAdapter,
  AgentRequest,
  AgentResponse,
  ChatMessage,
  AgentConfig,
} from "./types";

export type ZeroMode = "cli" | "server";

export class ZeroAdapter implements AgentAdapter {
  name = "zero";
  type: "sdk" | "cli" | "http";
  private mode: ZeroMode;
  private cliPath: string;
  private serverUrl: string;

  constructor(options?: {
    mode?: ZeroMode;
    cliPath?: string;
    serverUrl?: string;
  }) {
    this.mode = options?.mode || "cli";
    this.cliPath = options?.cliPath || "zero";
    this.serverUrl = options?.serverUrl || "http://localhost:8080";
    this.type = this.mode === "server" ? "http" : "cli";
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async isAvailable(): Promise<boolean> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/health`);
        return res.ok;
      } catch {
        return false;
      }
    }
    // CLI mode: we can't easily check without @tauri-apps/plugin-shell
    // which isn't available in vitest. Just return false in test environment.
    return false;
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    if (this.mode === "server") {
      return this.executeViaHttp(req);
    }
    return { content: "CLI mode requires Tauri runtime", success: false };
  }

  private async executeViaHttp(req: AgentRequest): Promise<AgentResponse> {
    try {
      const res = await fetch(`${this.serverUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.prompt,
          projectPath: req.projectPath,
        }),
      });
      const data = await res.json();
      return { content: data.content || "", success: res.ok };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: req.prompt,
            projectPath: req.projectPath,
          }),
        });
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value, { stream: true });
        }
      } catch (err) {
        yield `Error: ${err}`;
      }
    } else {
      yield "CLI mode requires Tauri runtime";
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({
      prompt: lastMessage.content,
      projectPath: "",
    });
  }

  async getConfig(): Promise<AgentConfig> {
    if (this.mode === "server") {
      try {
        const res = await fetch(`${this.serverUrl}/api/config`);
        return await res.json();
      } catch {
        return {};
      }
    }
    return {};
  }
}
