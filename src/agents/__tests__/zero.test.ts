import { describe, it, expect } from "vitest";
import { ZeroAdapter } from "../zero";

describe("ZeroAdapter", () => {
  it("has correct name and type", () => {
    const adapter = new ZeroAdapter();
    expect(adapter.name).toBe("zero");
    expect(adapter.type).toBe("cli");
  });

  it("reports unavailable when CLI not found", async () => {
    const adapter = new ZeroAdapter();
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});
