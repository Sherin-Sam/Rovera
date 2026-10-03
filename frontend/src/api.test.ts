import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
let client: typeof import("./api");
beforeAll(async () => {
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: vi.fn() });
  client = await import("./api");
});
afterEach(() => {
  vi.restoreAllMocks();
  client.setToken("");
});
describe("operator API boundary", () => {
  it("surfaces a denied remote command instead of reporting success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Remote viewer is read-only." }),
      }),
    );
    await expect(client.api("/estop", {})).rejects.toThrow(
      "Remote viewer is read-only.",
    );
  });
  it("attaches the operator token only as an authorization header", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ state: "PAUSED" }) });
    vi.stubGlobal("fetch", fetch);
    client.setToken("session-only");
    await client.api("/mission/pause", {});
    expect(fetch).toHaveBeenCalledWith(
      "/api/mission/pause",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-only",
        }),
      }),
    );
    expect(fetch.mock.calls[0][0]).not.toContain("session-only");
  });
  it("makes malformed validation errors understandable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          detail: [{ loc: ["body", "goal"], msg: "invalid" }],
        }),
      }),
    );
    await expect(client.api("/mission", { goal: [99, 99] })).rejects.toThrow(
      "Check the input values",
    );
  });
});
