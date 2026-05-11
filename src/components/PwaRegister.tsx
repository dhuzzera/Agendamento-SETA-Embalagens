import { useEffect } from "react";

/**
 * Registra o Service Worker apenas em produção e fora de iframes/previews
 * Lovable. Também limpa SWs já registrados quando estiver em iframe/preview,
 * para que mudanças no editor não fiquem presas em cache.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.app") === false && host.includes("localhost");

    // Em iframe ou preview: desregistra qualquer SW antigo e sai.
    if (isInIframe || isPreviewHost) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    // Produção (domínio publicado): registra o SW gerado pelo vite-plugin-pwa.
    const url = "/sw.js";
    navigator.serviceWorker.register(url, { scope: "/" }).catch(() => {
      /* falha silenciosa — sem PWA não há regressão funcional */
    });
  }, []);

  return null;
}
