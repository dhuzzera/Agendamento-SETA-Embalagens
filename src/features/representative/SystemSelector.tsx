import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, BarChart3, ArrowRight, Lock } from "lucide-react";

type SystemOption = {
  id: string;
  title: string;
  description: string;
  icon: typeof Calendar;
  route: string;
  available: boolean;
  badge?: string;
};

const SYSTEMS: SystemOption[] = [
  {
    id: "agendamento",
    title: "Agendamento Comercial",
    description: "Gerencie reuniões, disponibilidade, clientes e resultados comerciais.",
    icon: Calendar,
    route: "/agendamento",
    available: true,
  },
  {
    id: "dashboard-comercial",
    title: "Dashboard Comercial",
    description: "Indicadores de vendas, metas e performance da equipe.",
    icon: BarChart3,
    route: "#",
    available: false,
    badge: "Em breve",
  },
];

export function SystemSelector() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <SetaLogo variant="auto" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold">
            Olá, {profile?.full_name?.split(" ")[0]}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            Escolha o sistema que deseja acessar.
          </p>
        </div>

        <div className="space-y-3">
          {SYSTEMS.map((system) => {
            const Icon = system.icon;
            return (
              <Card
                key={system.id}
                className={`transition-all ${
                  system.available
                    ? "cursor-pointer hover:border-primary hover:shadow-md"
                    : "opacity-60"
                }`}
                onClick={() => {
                  if (system.available) {
                    // Salva a escolha e navega
                    localStorage.setItem("seta:last-system", system.id);
                    navigate({ to: system.route });
                  }
                }}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      system.available
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {system.available ? (
                      <Icon className="h-6 w-6" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{system.title}</h3>
                      {system.badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {system.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {system.description}
                    </p>
                  </div>
                  {system.available && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          SETA Embalagens — Plataforma interna
        </p>
      </div>
    </div>
  );
}
