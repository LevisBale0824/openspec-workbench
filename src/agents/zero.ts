import { Command } from "@tauri-apps/plugin-shell";
import {
  AgentAdapter,
  AgentRequest,
  AgentResponse,
  ChatMessage,
  AgentConfig,
} from "./types";

/**
 * CLI adapter for Zero (AI coding agent).
 * Placeholder — reports unavailable until the CLI is found.
 * On Windows, wraps with `cmd /C` to resolve .cmd scripts.
 */
export class ZeroAdapter implements AgentAdapter {
  name = "zero";
  type: "cli" = "cli";

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async isAvailable(): Promise<boolean> {
    try {
      const { program, args } = this.wrapCommand(["--version"]);
      const output = await Command.create(program, args).execute();
      return output.code === 0;
    } catch {
      return false;
    }
  }

  async execute(req: AgentRequest): Promise<AgentResponse> {
    try {
      const { program, args } = this.wrapCommand(["run", req.prompt]);
      const output = await Command.create(program, args).execute();
      if (output.code !== 0) {
        return { content: output.stderr || `Exit code: ${output.code}`, success: false };
      }
      return { content: output.stdout, success: true };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    const { program, args } = this.wrapCommand(["run", req.prompt]);
    const command = Command.create(program, args);

    const queue: { text: string; done: boolean }[] = [];
    let resolveNext: ((value: void) => void) | null = null;

    const notify = () => {
      if (resolveNext) { resolveNext(); resolveNext = null; }
    };

    const waitForItem = (): Promise<void> => {
      if (queue.length > 0) return Promise.resolve();
      return new Promise<void>((r) => { resolveNext = r; });
    };

    command.stdout.on("data", (line: string) => {
      const trimmed = line.trim();
      if (trimmed) { queue.push({ text: trimmed, done: false }); notify(); }
    });

    command.stderr.on("data", (line: string) => {
      const trimmed = line.trim();
      if (trimmed) { queue.push({ text: `[stderr] ${trimmed}`, done: false }); notify(); }
    });

    command.on("close", () => { queue.push({ text: "", done: true }); notify(); });
    command.on("error", (err: string) => {
      queue.push({ text: `Error: ${err}`, done: false });
      queue.push({ text: "", done: true });
      notify();
    });

    try {
      await command.spawn();
    } catch (err) {
      yield `Error: ${err}`;
      return;
    }

    while (true) {
      await waitForItem();
      while (queue.length > 0) {
        const item = queue.shift()!;
        if (item.done) return;
        if (item.text) yield item.text;
      }
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({ prompt: lastMessage.content, projectPath: "" });
  }

  async getConfig(): Promise<AgentConfig> {
    return {};
  }

  private wrapCommand(zeroArgs: string[]): { program: string; args: string[] } {
    return { program: "zero", args: zeroArgs };
  }
}
