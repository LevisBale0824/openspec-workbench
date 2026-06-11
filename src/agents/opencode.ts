import { Command, Child } from "@tauri-apps/plugin-shell";
import { AgentAdapter, AgentRequest, AgentResponse, ChatMessage, AgentConfig } from "./types";

interface ParsedEvent {
  displayText: string;
  isQuestion: boolean;
}

/**
 * CLI adapter for OpenCode (https://opencode.ai)
 *
 * Uses interactive mode (--interactive) for bidirectional communication:
 * - Spawns a long-lived process with stdin/stdout streaming
 * - Detects when the agent asks a question and prompts the user for input
 * - Uses --session for cross-step context persistence
 * - Supports --thinking to show reasoning blocks
 */
export class OpenCodeAdapter implements AgentAdapter {
  name = "opencode";
  type: "cli" = "cli";

  private activeProcess: Child | null = null;

  async start(): Promise<void> {}

  async stop(): Promise<void> {
    await this.killProcess();
  }

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
      const cmdArgs = this.buildArgsNonInteractive(req);
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
    // Kill any previous process
    await this.killProcess();

    const cmdArgs = this.buildArgs(req);
    const { program, args } = this.wrapCommand(cmdArgs);
    console.log("[opencode] spawning:", program, args.join(" "));

    const command = Command.create(program, args);
    const queue: Item[] = [];
    let resolveNext: ((value: void) => void) | null = null;
    let processClosed = false;

    const push = (item: Item) => {
      queue.push(item);
      if (resolveNext) { resolveNext(); resolveNext = null; }
    };
    const waitForItem = (): Promise<void> => {
      if (queue.length > 0) return Promise.resolve();
      return new Promise<void>((r) => { resolveNext = r; });
    };

    // stdout event stream
    command.stdout.on("data", (line: string) => {
      const trimmed = line.trim();
      if (trimmed) push({ kind: "stdout", text: trimmed });
    });

    // stderr
    command.stderr.on("data", (line: string) => {
      const trimmed = line.trim();
      if (trimmed) push({ kind: "stderr", text: trimmed });
    });

    // Process exit
    command.on("close", () => {
      processClosed = true;
      push({ kind: "done" });
    });

    command.on("error", (err: string) => {
      push({ kind: "stderr", text: `[error] ${err}` });
      processClosed = true;
      push({ kind: "done" });
    });

    // Spawn the process
    try {
      this.activeProcess = await command.spawn();
    } catch (err) {
      yield `Error: ${err}`;
      return;
    }

    // Write the prompt to stdin (interactive mode expects initial message via stdin)
    try {
      console.log("[opencode] writing prompt to stdin");
      await this.activeProcess.write(req.prompt + "\n");
    } catch (err) {
      yield `Error writing prompt: ${err}`;
      await this.killProcess();
      return;
    }

    // Abort signal listener
    const onAbort = () => {
      console.log("[opencode] abort signal received");
      this.killProcess();
    };
    req.signal?.addEventListener("abort", onAbort, { once: true });

    // Buffer for detecting question-like patterns in output
    let lastEventText = "";
    const NO_DATA_TIMEOUT = 5000;  // 5 seconds of silence before assuming waiting

    try {
      while (true) {
        // Wait for data with timeout
        const timeoutPromise = new Promise<void>((r) => setTimeout(r, NO_DATA_TIMEOUT));
        const waitPromise = waitForItem();

        await Promise.race([waitPromise, timeoutPromise]);

        if (processClosed && queue.length === 0) break;

        // If timeout fired and queue is empty, check if we should prompt user
        if (queue.length === 0 && !processClosed) {
          // Check if last output looks like a question
          if (this.looksLikeQuestion(lastEventText) && req.onUserInput) {
            yield "\n[等待你的回答...]\n";
            try {
              const answer = await Promise.race([
                req.onUserInput(),
                new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error("timeout")), 300000)
                ),
              ]);
              await this.activeProcess?.write(answer + "\n");
              lastEventText = "";
            } catch {
              yield "\n[输入超时，继续执行...]\n";
            }
          }
          continue;
        }

        // Process all available items
        while (queue.length > 0) {
          const item = queue.shift()!;
          if (item.kind === "done") return;

          if (item.kind === "stderr") {
            yield item.text;
            continue;
          }

          // Parse stdout lines as JSON events
          const text = item.text;
          try {
            const event = JSON.parse(text);
            const parsed = this.formatEvent(event);
            if (parsed.displayText) {
              lastEventText = parsed.displayText;
              yield parsed.displayText;
            }
            // If this event is a question, prompt user
            if (parsed.isQuestion && req.onUserInput && this.activeProcess) {
              yield "\n";
              try {
                const answer = await Promise.race([
                  req.onUserInput(),
                  new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("timeout")), 300000)
                  ),
                ]);
                await this.activeProcess.write(answer + "\n");
                lastEventText = "";
              } catch {
                yield "\n[输入超时，继续执行...]\n";
              }
            }
          } catch {
            // Non-JSON output, display as-is
            lastEventText = text;
            yield text;
          }
        }
      }
    } catch (err) {
      yield `\nError: ${err}`;
    } finally {
      req.signal?.removeEventListener("abort", onAbort);
    }
  }

  async *chat(messages: ChatMessage[], projectPath: string): AsyncIterable<string> {
    const lastMessage = messages[messages.length - 1];
    yield* this.executeStream({ prompt: lastMessage.content, projectPath });
  }

  async getConfig(): Promise<AgentConfig> {
    return {};
  }

  // ============================================================
  // Private: Command building
  // ============================================================

  private wrapCommand(opencodeArgs: string[]): { program: string; args: string[] } {
    return { program: "opencode", args: opencodeArgs };
  }

  private buildArgs(req: AgentRequest): string[] {
    const args = ["run", "--interactive", "--format", "json", "--thinking"];
    if (req.sessionId) {
      args.push("--session", req.sessionId);
    }
    if (req.projectPath) {
      args.push("--dir", req.projectPath);
    }
    return args;
  }

  private buildArgsNonInteractive(req: AgentRequest): string[] {
    const args = ["run", "--format", "json"];
    if (req.sessionId) {
      args.push("--session", req.sessionId);
    }
    if (req.projectPath) {
      args.push("--dir", req.projectPath);
    }
    args.push("--", req.prompt);
    return args;
  }

  // ============================================================
  // Private: Process management
  // ============================================================

  private async killProcess(): Promise<void> {
    if (this.activeProcess) {
      try {
        console.log("[opencode] killing active process");
        await this.activeProcess.kill();
      } catch {
        // Process may already be dead
      }
      this.activeProcess = null;
    }
  }

  // ============================================================
  // Private: Event parsing
  // ============================================================

  private parseOutput(stdout: string): string {
    const contents: string[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        const parsed = this.formatEvent(event);
        if (parsed.displayText) contents.push(parsed.displayText);
      } catch {
        contents.push(trimmed);
      }
    }
    return contents.join("\n");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatEvent(event: any): ParsedEvent {
    switch (event.type) {
      case "step_start":
        return { displayText: "", isQuestion: false };

      case "step_finish": {
        const tokens = event.part?.tokens;
        if (tokens) {
          return {
            displayText: `\n[done] tokens: ${tokens.total} | cost: $${event.part?.cost ?? 0}`,
            isQuestion: false,
          };
        }
        return { displayText: "", isQuestion: false };
      }

      case "content_block_start":
        return { displayText: event.content_block?.text ?? "", isQuestion: false };

      case "content_block_delta":
        return { displayText: event.delta?.text ?? "", isQuestion: false };

      case "assistant":
      case "message":
        if (typeof event.content === "string") {
          return { displayText: event.content, isQuestion: false };
        }
        if (Array.isArray(event.content)) {
          const text = event.content
            .map((b: any) => b.text ?? (b.type === "text" ? b.value ?? "" : ""))
            .join("");
          return { displayText: text, isQuestion: false };
        }
        if (typeof event.message === "string") {
          return { displayText: event.message, isQuestion: false };
        }
        return { displayText: "", isQuestion: false };

      case "text":
        return {
          displayText: event.part?.text ?? event.text ?? "",
          isQuestion: false,
        };

      case "tool_use":
      case "tool_call": {
        const name = event.name ?? event.tool ?? event.function?.name ?? "?";
        return {
          displayText: `\n[using ${name}]`,
          isQuestion: this.isQuestionToolName(name),
        };
      }

      case "tool_result": {
        const result = event.content ?? event.result ?? "";
        const preview = typeof result === "string"
          ? result.slice(0, 300)
          : JSON.stringify(result).slice(0, 300);
        return { displayText: preview ? `\n[结果] ${preview}` : "", isQuestion: false };
      }

      case "thinking":
      case "reasoning": {
        const thought = event.text ?? event.content ?? event.thinking ?? "";
        return {
          displayText: typeof thought === "string" && thought ? `\n[思考] ${thought}` : "",
          isQuestion: false,
        };
      }

      case "error":
        return {
          displayText: `\n[error] ${event.message ?? event.error ?? "unknown"}`,
          isQuestion: false,
        };

      default: {
        const text = event.text ?? event.content ?? event.message
          ?? event.delta?.text ?? event.part?.text;
        if (typeof text === "string" && text.length > 0) {
          return { displayText: text, isQuestion: false };
        }
        return { displayText: "", isQuestion: false };
      }
    }
  }

  // ============================================================
  // Private: Question detection
  // ============================================================

  private isQuestionToolName(name: string): boolean {
    const lower = name.toLowerCase();
    return /^(ask|question|ask_user|user_input|confirm|prompt)$/.test(lower)
      || lower.includes("ask")
      || lower.includes("question");
  }

  private looksLikeQuestion(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    // Heuristic: text ends with ? or is a known question pattern
    return trimmed.endsWith("?")
      || trimmed.endsWith("？")
      || /^(what|which|how|should|can|could|would|do you|choose|select|pick)/i.test(trimmed);
  }
}

type Item =
  | { kind: "stdout"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "done" };
