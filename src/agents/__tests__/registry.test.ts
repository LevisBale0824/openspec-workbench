import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../registry";
import { AgentAdapter } from "../types";

function createMockAgent(name: string): AgentAdapter {
  return {
    name,
    type: "http",
    start: async () => {},
    stop: async () => {},
    isAvailable: async () => true,
    execute: async () => ({ content: "ok", success: true }),
    executeStream: async function* () {
      yield "ok";
    },
    chat: async function* () {
      yield "ok";
    },
    getConfig: async () => ({ model: "test" }),
  };
}

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("registers and retrieves an agent", () => {
    const agent = createMockAgent("test-agent");
    registry.register(agent);
    expect(registry.get("test-agent")).toBe(agent);
  });

  it("lists all registered agents", () => {
    registry.register(createMockAgent("a"));
    registry.register(createMockAgent("b"));
    expect(registry.list().map((a) => a.name)).toEqual(["a", "b"]);
  });

  it("returns undefined for unknown agent", () => {
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("sets active agent", () => {
    registry.register(createMockAgent("a"));
    registry.register(createMockAgent("b"));
    registry.setActive("b");
    expect(registry.getActive()?.name).toBe("b");
  });

  it("throws when setting unknown active agent", () => {
    expect(() => registry.setActive("unknown")).toThrow();
  });
});
