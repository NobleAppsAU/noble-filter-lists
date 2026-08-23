import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

function environment(assetStatus = 200): Env {
  return {
    ASSETS: {
      fetch: vi.fn(async () =>
        new Response("[]", {
          status: assetStatus,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    },
  } as unknown as Env;
}

describe("Noble Filter Lists Worker", () => {
  it("reports its health without touching asset storage", async () => {
    const env = environment();
    const response = await worker.fetch(
      new Request("https://filters.matthewnoble.au/health"),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: "Noble Filter Lists",
      status: "ok",
    });
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("serves only the documented public assets", async () => {
    const env = environment();
    const response = await worker.fetch(
      new Request("https://filters.matthewnoble.au/v1/apple/easylist.json"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it("rejects unknown paths and write methods", async () => {
    const env = environment();
    const missing = await worker.fetch(
      new Request("https://filters.matthewnoble.au/private"),
      env,
    );
    const write = await worker.fetch(
      new Request("https://filters.matthewnoble.au/v1/manifest.json", {
        method: "POST",
      }),
      env,
    );

    expect(missing.status).toBe(404);
    expect(write.status).toBe(405);
  });
});
