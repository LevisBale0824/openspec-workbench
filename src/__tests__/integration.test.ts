import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../agents/registry";
import { AgentAdapter, ChatMessage } from "../agents/types";

function createMockStreamAgent(name: string): AgentAdapter {
  return {
    name,
    type: "http" as const,
    start: async () => {},
    stop: async () => {},
    isAvailable: async () => true,
    execute: async () => ({ content: "mock response", success: true }),
    executeStream: async function* (req) {
      yield `## ${req.workflow || "explore"} result\n\n`;
      yield "Mock analysis output for: " + req.prompt;
      // If sessionId is provided, show it
      if (req.sessionId) {
        yield `\n[session: ${req.sessionId}]`;
      }
      // If onUserInput is provided, simulate a Q&A cycle
      if (req.onUserInput) {
        yield "\n[提问] What approach should we use?";
        const answer = await req.onUserInput();
        yield `\n[回答] ${answer}`;
        yield "\nContinuing analysis...";
      }
      // Respect abort signal
      if (req.signal?.aborted) {
        return;
      }
    },
    chat: async function* (msgs, _projectPath) {
      const last = msgs[msgs.length - 1];
      yield `Updated based on: ${last.content}`;
    },
    getConfig: async () => ({ model: "mock" }),
  };
}

describe("Full workflow integration", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(createMockStreamAgent("opencode"));
    registry.register(createMockStreamAgent("zero"));
    registry.setActive("opencode");
  });

  it("has an active agent", () => {
    expect(registry.getActive()?.name).toBe("opencode");
  });

  it("can switch active agent", () => {
    registry.setActive("zero");
    expect(registry.getActive()?.name).toBe("zero");
  });

  it("can execute a workflow step with streaming", async () => {
    const agent = registry.getActive()!;
    const chunks: string[] = [];
    for await (const chunk of agent.executeStream({
      prompt: "Add user authentication",
      projectPath: "/test",
      workflow: "explore",
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("explore result");
  });

  it("can execute with session ID", async () => {
    const agent = registry.getActive()!;
    const chunks: string[] = [];
    for await (const chunk of agent.executeStream({
      prompt: "Explore the codebase",
      projectPath: "/test",
      workflow: "explore",
      sessionId: "openspec-test123",
    })) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toContain("openspec-test123");
  });

  it("can handle interactive Q&A via onUserInput", async () => {
    const agent = registry.getActive()!;
    const chunks: string[] = [];

    let inputRequested = false;
    const result = agent.executeStream({
      prompt: "Design a system",
      projectPath: "/test",
      workflow: "propose",
      onUserInput: async () => {
        inputRequested = true;
        return "Use microservices";
      },
    });

    for await (const chunk of result) {
      chunks.push(chunk);
    }

    const output = chunks.join("");
    expect(output).toContain("[提问]");
    expect(output).toContain("[回答] Use microservices");
    expect(inputRequested).toBe(true);
  });

  it("can abort execution via signal", async () => {
    const controller = new AbortController();

    // Create an agent that yields slowly and checks abort
    const slowAgent: AgentAdapter = {
      name: "slow",
      type: "http" as const,
      start: async () => {},
      stop: async () => {},
      isAvailable: async () => true,
      execute: async () => ({ content: "", success: true }),
      executeStream: async function* (req) {
        yield "Starting...";
        // Simulate work, check abort signal
        await new Promise((r) => setTimeout(r, 50));
        if (req.signal?.aborted) {
          yield "\n[aborted]";
          return;
        }
        yield "\nDone.";
      },
      chat: async function* () { yield ""; },
      getConfig: async () => ({}),
    };

    const result = slowAgent.executeStream({
      prompt: "test",
      projectPath: "/test",
      signal: controller.signal,
    });

    // Abort after a short delay
    setTimeout(() => controller.abort(), 10);

    const chunks: string[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toContain("[aborted]");
  });

  it("can chat for corrections", async () => {
    const agent = registry.getActive()!;
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "Change refresh token to Redis",
        timestamp: Date.now(),
      },
    ];
    const chunks: string[] = [];
    for await (const chunk of agent.chat(messages, "/test")) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toContain("Updated based on");
  });

  it("lists all registered agents", () => {
    expect(registry.list()).toHaveLength(2);
  });
});
