import { supabase } from "@/integrations/supabase/client";

/**
 * Converte uma string base64url para Uint8Array (necessário para applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Retorna a VAPID public key configurada no ambiente.
 * Deve ser a mesma usada na Edge Function send-push.
 */
function getVapidPublicKey(): string | null {
  return (
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? null
  );
}

/**
 * Verifica se o navegador suporta Push Notifications
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Retorna o status atual da permissão de push
 */
export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Solicita permissão e registra a subscription no Supabase.
 * Retorna true se registrou com sucesso.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    console.warn("[Push] VITE_VAPID_PUBLIC_KEY not configured");
    return false;
  }

  try {
    // Pede permissão
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // Obtém o service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Verifica se já tem uma subscription ativa
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Cria nova subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Extrai as keys
    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh = subJson.keys!.p256dh!;
    const auth = subJson.keys!.auth!;

    // Salva no Supabase (upsert por user_id + endpoint)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: "user_id,endpoint" },
    );

    if (error) {
      console.error("[Push] Failed to save subscription:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Push] Subscribe error:", err);
    return false;
  }
}

/**
 * Remove a subscription do push (unsubscribe)
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Remove do Supabase
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);
    }

    return true;
  } catch (err) {
    console.error("[Push] Unsubscribe error:", err);
    return false;
  }
}

/**
 * Verifica se o usuário atual já tem uma subscription ativa
 */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
