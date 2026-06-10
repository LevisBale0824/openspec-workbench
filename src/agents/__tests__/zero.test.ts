import { describe, it, expect } from "vitest";
import { ZeroAdapter } from "../zero";

describe("ZeroAdapter", () => {
  it("defaults to cli mode", () => {
    const adapter = new ZeroAdapter();
    expect(adapter.name).toBe("zero");
  });

  it("accepts server mode", () => {
    const adapter = new ZeroAdapter({
      mode: "server",
      serverUrl: "http://localhost:9999",
    });
    expect(adapter).toBeDefined();
  });

  it("reports unavailable when server not running", async () => {
    const adapter = new ZeroAdapter({
      mode: "server",
      serverUrl: "http://localhost:99999",
    });
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});
