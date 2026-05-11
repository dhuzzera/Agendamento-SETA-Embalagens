import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

/**
 * Aplica políticas de cache HTTP por tipo de recurso.
 *
 * - Assets com hash no nome (Vite emite `/assets/[name]-[hash].ext` e
 *   `/_build/...`) são imutáveis: cache agressivo de 1 ano.
 * - Fontes (woff2) e imagens estáticas (svg/png/jpg/webp/avif/ico): 30 dias
 *   no browser e 1 ano no CDN, com `stale-while-revalidate` para evitar
 *   esperas em revalidação.
 * - HTML/respostas dinâmicas: `no-cache` (sempre revalida via ETag, que o
 *   Cloudflare gera automaticamente) — evita servir HTML obsoleto após
 *   redeploys.
 *
 * Compressão (brotli/gzip) e geração de ETag são aplicadas automaticamente
 * pela camada de borda da Cloudflare; aqui apenas garantimos os cabeçalhos
 * corretos para que ela faça o trabalho.
 */
function applyCachePolicy(request: Request, response: Response): Response {
  // Não sobrescrever Cache-Control já definido pelo handler upstream.
  if (response.headers.has("cache-control")) return response;

  const url = new URL(request.url);
  const pathname = url.pathname;
  const accept = request.headers.get("accept") ?? "";
  const isHtml =
    accept.includes("text/html") ||
    (response.headers.get("content-type") ?? "").includes("text/html");

  // Não cachear chamadas server-fn / API
  if (pathname.startsWith("/_serverFn") || pathname.startsWith("/api/")) {
    response.headers.set("cache-control", "no-store");
    return response;
  }

  // Bundles com hash imutável
  if (
    pathname.startsWith("/_build/") ||
    pathname.startsWith("/assets/") ||
    /\.[a-f0-9]{8,}\.(?:js|css|woff2?|map)$/i.test(pathname)
  ) {
    response.headers.set("cache-control", "public, max-age=31536000, immutable");
    return response;
  }

  // Estáticos sem hash (favicon, fontes, imagens públicas)
  if (/\.(?:woff2?|ttf|otf|svg|png|jpe?g|webp|avif|ico|gif)$/i.test(pathname)) {
    response.headers.set(
      "cache-control",
      "public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400",
    );
    return response;
  }

  // Documentos HTML / SSR — sempre revalidar (ETag faz o resto)
  if (isHtml) {
    response.headers.set("cache-control", "public, max-age=0, must-revalidate");
  }

  return response;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applyCachePolicy(request, normalized);
    } catch (error) {
      console.error(error);
      return applyCachePolicy(request, brandedErrorResponse());
    }
  },
};
