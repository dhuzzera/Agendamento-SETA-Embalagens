import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentNotifications } from "@/hooks/use-appointment-notifications";
import { AppHeader } from "@/components/AppHeader";
import { PendingConfirmationDialog } from "@/features/representative/PendingConfirmationDialog";
import { OnboardingWizard } from "@/features/representative/OnboardingWizard";
import { FullscreenSplashSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, profile, refresh } = useAuth();
  const location = useLocation();

  // Notificações em tempo real de novos agendamentos
  useAppointmentNotifications();

  // Splash full-screen apenas durante a hidratação inicial da sessão.
  if (loading) return <FullscreenSplashSkeleton />;
  if (!user) return <Navigate to="/login" />;

  // Se já temos user mas o profile ainda chega, NÃO bloqueia o layout —
  // renderiza header + skeleton para o conteúdo, melhorando FCP/TTI.
  if (
    profile?.must_change_password &&
    location.pathname !== "/alterar-senha"
  ) {
    return <Navigate to="/alterar-senha" />;
  }

  // Mostra wizard de onboarding se o representante nunca completou a configuração inicial
  if (
    profile &&
    !(profile as { onboarding_completed?: boolean }).onboarding_completed &&
    location.pathname !== "/alterar-senha" &&
    location.pathname !== "/perfil" &&
    location.pathname !== "/disponibilidade" &&
    location.pathname !== "/selecionar"
  ) {
    return (
      <div className="min-h-screen bg-secondary/40">
        <AppHeader />
        <main className="page-fade-in mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <OnboardingWizard />
        </main>
      </div>
    );
  }

  // Marca onboarding como completo quando chega na disponibilidade via setup
  // (removido - agora é feito por botão explícito na disponibilidade)

  // Tela de seleção de sistema: sem header, layout próprio
  if (location.pathname === "/selecionar") {
    return (
      <div className="min-h-screen bg-secondary/40">
        {profile ? <Outlet /> : <PageHeaderSkeleton />}
      </div>
    );
  }

  // CRM: tem seu próprio header, não mostra o AppHeader do agendamento
  if (location.pathname.startsWith("/crm")) {
    return (
      <div className="min-h-screen bg-secondary/40">
        <main className="page-fade-in">
          {profile ? <Outlet /> : <PageHeaderSkeleton />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <AppHeader />
      <PendingConfirmationDialog />
      <main
        key={location.pathname}
        className="page-fade-in mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {profile ? <Outlet /> : <PageHeaderSkeleton />}
      </main>
    </div>
  );
}
