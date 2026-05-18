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
  ArrowLeft,
  CheckCircle2,
  Users,
  Shield,
  BarChart3,
  FileText,
  Bell,
  Settings,
} from "lucide-react";

type Step = {
  icon: typeof UserCircle2;
  title: string;
  description: string;
};

const REP_STEPS: Step[] = [
  {
    icon: UserCircle2,
    title: "Complete seu perfil",
    description:
      "Adicione sua foto, telefone e biografia. Essas informações aparecem no seu link público — é o que seus clientes veem antes de agendar.",
  },
  {
    icon: Calendar,
    title: "Configure seus horários",
    description:
      "Seus horários padrão já estão configurados (Seg–Sex, 7h–18h, reuniões de 1h). Ajuste conforme sua rotina — adicione ou remova dias, altere duração das reuniões e bloqueie datas.",
  },
  {
    icon: LinkIcon,
    title: "Compartilhe seu link",
    description:
      "Seu link público e QR Code estão na tela Início. Copie e envie para seus clientes — eles agendam direto por lá, sem precisar ligar ou mandar mensagem.",
  },
  {
    icon: Bell,
    title: "Notificações automáticas",
    description:
      "Quando um cliente agendar, você recebe uma notificação no navegador. Permita as notificações quando o sistema pedir para não perder nenhum agendamento.",
  },
  {
    icon: CheckCircle2,
    title: "Confirme suas reuniões",
    description:
      "Após cada reunião, o sistema pede para você marcar como concluída (com resultado: venda, negociação ou reprovação) ou cancelada. Isso alimenta os relatórios da equipe.",
  },
];

const ADMIN_STEPS: Step[] = [
  {
    icon: Users,
    title: "Gerencie representantes",
    description:
      "Em Usuários, crie contas para os representantes. Cada um recebe um e-mail com link para definir a senha. Você pode ativar, desativar ou excluir a qualquer momento.",
  },
  {
    icon: Shield,
    title: "Modo Admin vs Representante",
    description:
      "No canto superior, use o seletor Admin/Representante para alternar a visualização. No modo Representante, você vê o sistema como seus representantes veem — útil para suporte.",
  },
  {
    icon: BarChart3,
    title: "Dashboard de vendas",
    description:
      "O painel mostra vendas fechadas, negociações em andamento, taxa de conversão e ranking dos representantes mais ativos. Tudo atualizado em tempo real.",
  },
  {
    icon: Calendar,
    title: "Agenda unificada",
    description:
      "Veja todos os agendamentos de todos os representantes em um calendário visual. Filtre por representante, status, modalidade ou resultado.",
  },
  {
    icon: FileText,
    title: "Relatórios automáticos",
    description:
      "Toda segunda-feira você recebe um e-mail com o resumo da semana. Também pode exportar relatórios em PDF ou CSV a qualquer momento pelo painel.",
  },
  {
    icon: Settings,
    title: "Configurações globais",
    description:
      "Em Configurações de deslocamento, defina o tempo entre visitas presenciais e o raio máximo. Essas regras valem para todos os representantes automaticamente.",
  },
];

export function OnboardingWizard() {
  const { profile, role, refresh } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const isAdmin = role === "admin";
  const steps = isAdmin ? ADMIN_STEPS : REP_STEPS;

  const completeOnboarding = async () => {
    if (!profile) return;
    if (isAdmin) {
      // Admin não precisa passar por perfil/disponibilidade
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", profile.id);
      await refresh();
      navigate({ to: "/dashboard" });
    } else {
      // Representante vai para o fluxo de perfil → disponibilidade
      navigate({ to: "/perfil", search: { setup: "1" } });
    }
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
            {isAdmin ? "Bem-vindo ao painel administrativo! 🎯" : "Bem-vindo à SETA Embalagens! 👋"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isAdmin
              ? "Conheça as ferramentas disponíveis para gerenciar sua equipe."
              : "Vamos configurar sua conta em poucos passos."}
          </p>
        </div>

        {/* Steps carousel */}
        <Card className="border-primary/20 shadow-md">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {currentStep + 1} de {steps.length}
              </span>
              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      idx === currentStep ? "bg-primary" : idx < currentStep ? "bg-green-400" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {(() => {
                  const Icon = steps[currentStep].icon;
                  return <Icon className="h-6 w-6" />;
                })()}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{steps[currentStep].title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {steps[currentStep].description}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Anterior
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)}>
                  Próximo
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" onClick={completeOnboarding}>
                  {isAdmin ? "Ir para o painel" : "Começar configuração"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isAdmin
            ? "Você pode acessar essas funções a qualquer momento pelo menu."
            : "Você pode ajustar tudo isso depois nas configurações."}
        </p>
      </div>
    </div>
  );
}
