import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed,
} from "@/lib/push-notifications";

export function PushNotificationToggle() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    void isSubscribed().then(setSubscribed);
  }, []);

  if (!supported || !user) return null;

  const permission = getPushPermission();
  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Notificações bloqueadas no navegador
      </div>
    );
  }

  const toggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush(user.id);
        setSubscribed(false);
        toast.success("Notificações push desativadas");
      } else {
        const success = await subscribeToPush(user.id);
        if (success) {
          setSubscribed(true);
          toast.success("Notificações push ativadas!");
        } else {
          toast.error("Não foi possível ativar as notificações");
        }
      }
    } catch {
      toast.error("Erro ao alterar notificações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      size="sm"
      onClick={toggle}
      disabled={loading}
      className="gap-2"
    >
      {subscribed ? (
        <>
          <Bell className="h-4 w-4 text-primary" />
          Push ativo
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Ativar push
        </>
      )}
    </Button>
  );
}
