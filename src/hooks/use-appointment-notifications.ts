import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

/**
 * Escuta novos agendamentos em tempo real e envia uma notificação
 * do navegador (Notification API) + toast para o representante logado.
 */
export function useAppointmentNotifications() {
  const { user, role } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Pede permissão de notificação na primeira vez
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const channel = supabase
      .channel("new-appointments-notify")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
        },
        async (payload) => {
          const newAppt = payload.new as {
            representative_id: string;
            appointment_date: string;
            start_time: string;
            client_id: string;
            meeting_type: string;
          };

          // Só notifica se o agendamento é para este representante
          // (ou se é admin, notifica todos)
          if (role !== "admin" && newAppt.representative_id !== user.id) return;

          // Busca nome do cliente
          const { data: client } = await supabase
            .from("clients")
            .select("name")
            .eq("id", newAppt.client_id)
            .maybeSingle();

          const clientName = client?.name ?? "Novo cliente";
          const date = newAppt.appointment_date.split("-").reverse().join("/");
          const time = newAppt.start_time.slice(0, 5);
          const type = newAppt.meeting_type === "presencial" ? "presencial" : "online";

          const title = "Novo agendamento!";
          const body = `${clientName} agendou uma reunião ${type} para ${date} às ${time}`;

          // Toast no app
          toast.success(title, { description: body });

          // Notificação do navegador
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(title, {
              body,
              icon: "/icon-192.png",
              badge: "/favicon-32.png",
              tag: `appt-${payload.new.id}`,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, role]);
}
