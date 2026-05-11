import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { holidaysBetween, type Holiday } from "@/lib/holidays";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STORAGE_KEY = (userId: string, date: string) =>
  `seta:holiday-confirmed:${userId}:${date}`;

type PendingHoliday = Holiday & { blockId: string };

/**
 * Mostra um pop-up de confirmação para feriados nacionais que estão
 * previamente bloqueados na agenda do representante e ocorrem dentro
 * dos próximos 7 dias. O representante pode confirmar a indisponibilidade
 * ou liberar o dia (removendo o bloqueio).
 */
export function HolidayConfirmDialog({ representativeId }: { representativeId?: string }) {
  const [pending, setPending] = useState<PendingHoliday[]>([]);
  const [busy, setBusy] = useState(false);

  // Feriados nacionais nos próximos 7 dias
  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 7);
    return holidaysBetween(today, weekAhead);
  }, []);

  useEffect(() => {
    if (!representativeId || upcomingHolidays.length === 0) return;
    let cancelled = false;

    const load = async () => {
      const dates = upcomingHolidays.map((h) => h.date);
      const { data } = await supabase
        .from("blocks")
        .select("id, block_date, start_time, end_time")
        .eq("representative_id", representativeId)
        .in("block_date", dates);

      if (cancelled) return;

      const blocked = new Map<string, string>();
      for (const b of data ?? []) {
        // Apenas bloqueios de dia inteiro contam como feriado padrão
        if (b.start_time === null && b.end_time === null) {
          blocked.set(b.block_date, b.id);
        }
      }

      const queue: PendingHoliday[] = [];
      for (const h of upcomingHolidays) {
        const blockId = blocked.get(h.date);
        if (!blockId) continue;
        const dismissed = localStorage.getItem(STORAGE_KEY(representativeId, h.date));
        if (dismissed) continue;
        queue.push({ ...h, blockId });
      }
      setPending(queue);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [representativeId, upcomingHolidays]);

  const current = pending[0];
  if (!current || !representativeId) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY(representativeId, current.date), "1");
    setPending((prev) => prev.slice(1));
  };

  const handleConfirm = () => {
    dismiss();
  };

  const handleRelease = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("id", current.blockId);
      if (error) throw error;
      toast.success("Bloqueio do feriado removido. Você ficará disponível nesse dia.");
      dismiss();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível liberar o dia";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const niceDate = format(parseISO(current.date), "EEEE, dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CalendarOff className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Feriado nacional na próxima semana</DialogTitle>
          <DialogDescription className="text-center">
            <span className="block font-semibold text-foreground">{current.name}</span>
            <span className="mt-1 block capitalize">{niceDate}</span>
            <span className="mt-3 block">
              Esse dia está bloqueado na sua agenda. Deseja confirmar que ficará indisponível?
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={handleConfirm} disabled={busy} className="w-full">
            Sim, manter indisponível
          </Button>
          <Button
            onClick={handleRelease}
            disabled={busy}
            variant="outline"
            className="w-full"
          >
            Liberar este dia para agendamentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
