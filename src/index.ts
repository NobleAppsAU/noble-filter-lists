const allowedAssets = new Set([
  "/v1/manifest.json",
  "/v1/apple/easylist.json",
  "/v1/apple/easyprivacy.json",
]);

const securityHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...securityHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function withPublicHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }
  headers.set(
    "Cache-Control",
    pathname === "/v1/manifest.json"
      ? "public, max-age=300, stale-while-revalidate=3600"
      : "public, max-age=86400, stale-while-revalidate=604800",
  );
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...securityHeaders,
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/health") {
      return request.method === "HEAD"
        ? new Response(null, { status: 200, headers: securityHeaders })
        : jsonResponse({ service: "Noble Filter Lists", status: "ok" });
    }

    if (!allowedAssets.has(url.pathname)) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const assetRequest = new Request(request, { method: "GET" });
    const assetResponse = await env.ASSETS.fetch(assetRequest);
    if (!assetResponse.ok) {
      console.warn("Filter-list asset unavailable", {
        path: url.pathname,
        status: assetResponse.status,
      });
    }

    const response = withPublicHeaders(assetResponse, url.pathname);
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  },
} satisfies ExportedHandler<Env>;

