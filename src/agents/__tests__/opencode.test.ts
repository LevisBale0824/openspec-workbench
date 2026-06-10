import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "../opencode";

describe("OpenCodeAdapter", () => {
  it("has correct name and type", () => {
    const adapter = new OpenCodeAdapter();
    expect(adapter.name).toBe("opencode");
    expect(adapter.type).toBe("sdk");
  });

  it("reports unavailable when server not running", async () => {
    const adapter = new OpenCodeAdapter({ serverUrl: "http://localhost:99999" });
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });

  it("returns error response when server unavailable", async () => {
    const adapter = new OpenCodeAdapter({ serverUrl: "http://localhost:99999" });
    const result = await adapter.execute({ prompt: "test", projectPath: "/tmp" });
    expect(result.success).toBe(false);
  });
});
