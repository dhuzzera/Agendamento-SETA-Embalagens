import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, profile } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (!user) return <Navigate to="/login" />;

  if (
    profile?.must_change_password &&
    location.pathname !== "/alterar-senha"
  ) {
    return <Navigate to="/alterar-senha" />;
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

