// Attaches the current Supabase session bearer token to every
// TanStack Start server function request (`/_serverFn/*`) so that
// `requireSupabaseAuth` middleware can validate the user.
//
// Uses createIsomorphicFn so it can be safely imported from server code
// (e.g. __root.tsx during SSR) — the server impl is a no-op.
import { createIsomorphicFn } from "@tanstack/react-start";
import { supabase } from "./client";

let installed = false;

export const installServerFnAuthFetch = createIsomorphicFn()
  .server(() => {
    /* no-op on server */
  })
  .client(() => {
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
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined),
          );
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
  });
