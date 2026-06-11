import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "../opencode";

describe("OpenCodeAdapter", () => {
  it("has correct name and type", () => {
    const adapter = new OpenCodeAdapter();
    expect(adapter.name).toBe("opencode");
    expect(adapter.type).toBe("cli");
  });

  it("reports unavailable when CLI not found", async () => {
    const adapter = new OpenCodeAdapter();
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});
