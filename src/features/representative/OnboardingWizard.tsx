import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetaLogo } from "@/components/SetaLogo";
import {
  UserCircle2,
  Calendar,
  Link as LinkIcon,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  {
    icon: UserCircle2,
    title: "Complete seu perfil",
    description:
      "Adicione sua foto, telefone e biografia. Essas informações aparecem no seu link público de agendamento.",
    action: "Editar perfil",
    route: "/perfil?setup=1",
  },
  {
    icon: Calendar,
    title: "Configure seus horários",
    description:
      "Seus horários padrão já estão configurados (Seg–Sex, 7h–18h). Ajuste conforme sua rotina — adicione ou remova dias e horários.",
    action: "Ver disponibilidade",
    route: "/disponibilidade",
  },
  {
    icon: LinkIcon,
    title: "Compartilhe seu link",
    description:
      "Seu link público já está ativo. Copie e envie para seus clientes — eles podem agendar reuniões diretamente por lá.",
    action: "Ver meu link",
    route: "/dashboard",
  },
];

export function OnboardingWizard() {
  const { profile, refresh } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const completeOnboarding = async () => {
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", profile.id);
    await refresh();
    navigate({ to: "/perfil", search: { setup: "1" } });
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <SetaLogo variant="auto" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Bem-vindo à SETA Embalagens! 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            Vamos configurar sua conta em 3 passos rápidos.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;

            return (
              <Card
                key={idx}
                className={`transition-all ${isActive ? "border-primary shadow-md" : isDone ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20" : "opacity-60"}`}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isDone
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Passo {idx + 1}
                      </span>
                      {isDone && (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          ✓ Pronto
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Action button */}
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={completeOnboarding} className="px-8">
            Começar configuração
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Você pode ajustar tudo isso depois nas configurações.
        </p>
      </div>
    </div>
  );
}
