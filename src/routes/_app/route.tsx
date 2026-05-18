import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useAppointmentNotifications } from "@/hooks/use-appointment-notifications";
import { AppHeader } from "@/components/AppHeader";
import { PendingConfirmationDialog } from "@/features/representative/PendingConfirmationDialog";
import { FullscreenSplashSkeleton, PageHeaderSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, profile } = useAuth();
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
