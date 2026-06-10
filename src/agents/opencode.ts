import { Command } from "@tauri-apps/plugin-shell";
import { AgentAdapter, AgentRequest, AgentResponse, ChatMessage, AgentConfig } from "./types";

/**
 * CLI adapter for OpenCode (https://opencode.ai)
 * Calls `opencode run` via Tauri Shell plugin.
 * On Windows, wraps with `cmd /C` to resolve .cmd scripts.
 */
export class OpenCodeAdapter implements AgentAdapter {
  name = "opencode";
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
      const cmdArgs = this.buildArgs(req);
      const { program, args } = this.wrapCommand(cmdArgs);
      const output = await Command.create(program, args).execute();

      if (output.code !== 0) {
        return { content: output.stderr || `Exit code: ${output.code}`, success: false };
      }

      const content = this.parseOutput(output.stdout);
      return { content: content || output.stdout, success: true };
    } catch (err) {
      return { content: String(err), success: false };
    }
  }

  async *executeStream(req: AgentRequest): AsyncIterable<string> {
    const cmdArgs = this.buildArgs(req);
    const { program, args } = this.wrapCommand(cmdArgs);
    console.log("[opencode] executing:", program, args.join(" "));

    try {
      const output = await Command.create(program, args).execute();
      console.log("[opencode] finished, code:", output.code, "stdout length:", output.stdout.length);

      if (output.code !== 0) {
        yield `[error] ${output.stderr || `Exit code: ${output.code}`}`;
        return;
      }

      const content = this.parseOutput(output.stdout);
      if (content) yield content;
    } catch (err) {
      console.error("[opencode] execute failed:", err);
      yield `Error: ${err}`;
    }
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({ prompt: lastMessage.content, projectPath: "" });
  }

  async getConfig(): Promise<AgentConfig> {
    return {};
  }

  /**
   * Returns the command config. Uses "opencode" as program name,
   * which matches the shell scope entry in capabilities/default.json.
   */
  private wrapCommand(opencodeArgs: string[]): { program: string; args: string[] } {
    return { program: "opencode", args: opencodeArgs };
  }

  private buildArgs(req: AgentRequest): string[] {
    const args = ["run", "--format", "json"];
    if (req.projectPath) {
      args.push("--dir", req.projectPath);
    }
    args.push("--", req.prompt);
    return args;
  }

  private parseOutput(stdout: string): string {
    const contents: string[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        const formatted = this.formatEvent(event);
        if (formatted) contents.push(formatted);
      } catch {
        contents.push(trimmed);
      }
    }
    return contents.join("\n");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatEvent(event: any): string {
    switch (event.type) {
      case "step_start":
        return "";
      case "text":
        return event.part?.text ?? "";
      case "step_finish": {
        const tokens = event.part?.tokens;
        if (tokens) {
          return `\n[done] tokens: ${tokens.total} | cost: $${event.part?.cost ?? 0}`;
        }
        return "";
      }
      case "content_block_delta":
        return event.delta?.text ?? "";
      case "assistant":
        return typeof event.content === "string" ? event.content : "";
      default:
        return "";
    }
  }
}
