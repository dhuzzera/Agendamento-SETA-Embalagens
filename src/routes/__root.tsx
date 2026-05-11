import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { PerformanceReporter } from "@/lib/perf-reporter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };
  const handleRetry = () => {
    router.invalidate();
    reset();
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Tentar novamente
          </button>
          <Link
            to="/"
            className="inline-flex rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Seta Embalagens — Agendamento Comercial" },
      {
        name: "description",
        content:
          "Sistema de agendamento dos representantes comerciais Seta Embalagens. Reserve uma reunião em poucos cliques.",
      },
      { property: "og:title", content: "Seta Embalagens — Agendamento Comercial" },
      { name: "twitter:title", content: "Seta Embalagens — Agendamento Comercial" },
      { name: "description", content: "Seta Agende is a web-based scheduling system for Seta Embalagens representatives." },
      { property: "og:description", content: "Seta Agende is a web-based scheduling system for Seta Embalagens representatives." },
      { name: "twitter:description", content: "Seta Agende is a web-based scheduling system for Seta Embalagens representatives." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c8e02594-2966-46f6-b349-c326f2590946/id-preview-cf131715--594eb6fb-102e-4b64-9d24-daa8117ba59c.lovable.app-1778517277487.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c8e02594-2966-46f6-b349-c326f2590946/id-preview-cf131715--594eb6fb-102e-4b64-9d24-daa8117ba59c.lovable.app-1778517277487.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      // Preconnect ao backend Supabase (auth/session é uma das primeiras
      // requisições; antecipar DNS+TLS reduz tempo até o primeiro dado e
      // melhora o LCP em telas com dados acima da dobra)
      { rel: "dns-prefetch", href: "https://rmqnyqzcxiqbjmryfhqe.supabase.co" },
      { rel: "preconnect", href: "https://rmqnyqzcxiqbjmryfhqe.supabase.co", crossOrigin: "anonymous" },
      // Preconnect ao CDN das fontes para encurtar handshake TLS/DNS
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Preload do CSS do Inter (display=swap evita FOIT/CLS, já que o
      // fallback no styles.css usa size-adjust para casar as métricas)
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
      // Preload do peso 600 do Inter (usado em headings/botões acima da
      // dobra) — evita o "swap" tardio do webfont no LCP
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <PerformanceReporter />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
