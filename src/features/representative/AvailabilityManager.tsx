import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Apple, Copy, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

type Avail = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  meeting_duration_min: number;
  active: boolean;
};

type Block = {
  id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function AvailabilityManager() {
  const { profile } = useAuth();
  const [avails, setAvails] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);

  // form
  const [wd, setWd] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [dur, setDur] = useState(30);

  // block form
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const load = async () => {
    if (!profile) return;
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase
        .from("availabilities")
        .select("*")
        .eq("representative_id", profile.id)
        .order("weekday"),
      supabase
        .from("blocks")
        .select("*")
        .eq("representative_id", profile.id)
        .order("block_date", { ascending: false }),
    ]);
    setAvails((a as Avail[]) ?? []);
    setBlocks((b as Block[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, [profile]);

  const addAvail = async () => {
    if (!profile) return;
    const { error } = await supabase.from("availabilities").insert({
      representative_id: profile.id,
      weekday: wd,
      start_time: start,
      end_time: end,
      meeting_duration_min: dur,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Disponibilidade adicionada");
      void load();
    }
  };

  const removeAvail = async (id: string) => {
    await supabase.from("availabilities").delete().eq("id", id);
    void load();
  };

  const addBlock = async () => {
    if (!profile || !blockDate) return;
    const { error } = await supabase.from("blocks").insert({
      representative_id: profile.id,
      block_date: blockDate,
      reason: blockReason || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bloqueio criado");
      setBlockDate("");
      setBlockReason("");
      void load();
    }
  };

  const removeBlock = async (id: string) => {
    await supabase.from("blocks").delete().eq("id", id);
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Disponibilidade</h1>
        <p className="text-muted-foreground">
          Defina seus horários de atendimento e bloqueios.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horários semanais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">Dia</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={wd}
                  onChange={(e) => setWd(parseInt(e.target.value))}
                >
                  {WEEKDAYS.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  value={dur}
                  onChange={(e) => setDur(parseInt(e.target.value) || 30)}
                />
              </div>
              <Button onClick={addAvail} className="self-end">
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar
              </Button>
            </div>

            <div className="divide-y rounded-md border">
              {avails.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhuma disponibilidade.
                </p>
              )}
              {avails.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">
                    <span className="font-medium">{WEEKDAYS[a.weekday]}</span>{" "}
                    <span className="text-muted-foreground">
                      {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)} •{" "}
                      {a.meeting_duration_min} min
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeAvail(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bloqueios e feriados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Motivo</Label>
                <Input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Férias, feriado…"
                />
              </div>
              <Button onClick={addBlock}>
                <Plus className="mr-1.5 h-4 w-4" /> Bloquear
              </Button>
            </div>

            <div className="divide-y rounded-md border">
              {blocks.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum bloqueio.</p>
              )}
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">
                    <span className="font-medium">{formatDate(b.block_date)}</span>
                    {b.reason && (
                      <span className="text-muted-foreground"> • {b.reason}</span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
