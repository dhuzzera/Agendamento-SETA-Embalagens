// Attaches the current Supabase session bearer token to every
// TanStack Start server function request (`/_serverFn/*`) so that
// `requireSupabaseAuth` middleware can validate the user.
//
// This file is client-only (`.client.ts`) — it is stripped from the
// server bundle. It must NOT import `client.server`.
import { supabase } from "./client";

let installed = false;

export function installServerFnAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url && url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // fall through to original fetch
    }
    return originalFetch(input, init);
  };
}
