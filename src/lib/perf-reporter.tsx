import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { supabase } from "@/integrations/supabase/client";

/**
 * Coleta Web Vitals (CLS, LCP, INP, FCP, TTFB) e envia para
 * `performance_metrics`. Também mede um TTI aproximado (tempo até a primeira
 * rota ficar idle após o load) por rota visitada.
 */
function normalizeRoute(pathname: string): string {
  // Agrupa rotas dinâmicas para não explodir cardinalidade.
  // /admin/usuarios -> /admin/usuarios
  // /agendar/joao-silva -> /agendar/:slug
  // /joao-silva -> /:slug (slug público de representante)
  if (!pathname || pathname === "/") return "/";
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] === "agendar" && segs[1]) return "/agendar/:slug";
  if (segs.length === 1 && !["login", "dashboard", "agenda", "admin", "disponibilidade"].includes(segs[0])) {
    return "/:slug";
  }
  return "/" + segs.join("/");
}

let vitalsRegistered = false;
let currentRoute = typeof window !== "undefined" ? normalizeRoute(window.location.pathname) : "/";

async function send(metric: Pick<Metric, "name" | "value" | "rating" | "navigationType">) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("performance_metrics").insert({
      route: currentRoute,
      metric_name: metric.name,
      value: metric.value,
      rating: metric.rating ?? null,
      navigation_type: metric.navigationType ?? null,
      user_id: user?.id ?? null,
      user_agent: navigator.userAgent.slice(0, 200),
    });
  } catch {
    /* noop — telemetria não pode quebrar a UI */
  }
}

function registerVitals() {
  if (vitalsRegistered || typeof window === "undefined") return;
  vitalsRegistered = true;
  onCLS(send);
  onLCP(send);
  onINP(send);
  onFCP(send);
  onTTFB(send);
}

export function PerformanceReporter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navStartRef = useRef<number>(performance.now());
  const reportedRef = useRef<string>("");

  // Registra listeners globais uma única vez.
  useEffect(() => {
    registerVitals();
  }, []);

  // Atualiza a rota corrente e mede TTI aproximado por navegação.
  useEffect(() => {
    const route = normalizeRoute(pathname);
    currentRoute = route;
    navStartRef.current = performance.now();

    const handle =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(() => {
            if (reportedRef.current === route) return;
            reportedRef.current = route;
            const tti = performance.now() - navStartRef.current;
            void send({
              name: "TTI" as Metric["name"],
              value: Math.round(tti),
              rating: tti < 1500 ? "good" : tti < 3500 ? "needs-improvement" : "poor",
              navigationType: "navigate",
            });
          }, { timeout: 5000 })
        : (setTimeout(() => {
            const tti = performance.now() - navStartRef.current;
            void send({
              name: "TTI" as Metric["name"],
              value: Math.round(tti),
              rating: tti < 1500 ? "good" : tti < 3500 ? "needs-improvement" : "poor",
              navigationType: "navigate",
            });
          }, 0) as unknown as number);

    return () => {
      if (typeof cancelIdleCallback !== "undefined" && typeof handle === "number") {
        try { cancelIdleCallback(handle); } catch { /* noop */ }
      }
    };
  }, [pathname]);

  return null;
}
