import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { FullscreenSplashSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, profile } = useAuth();
  const location = useLocation();
  if (loading) return <FullscreenSplashSkeleton />;
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
      <main
        key={location.pathname}
        className="page-fade-in mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <Outlet />
      </main>
    </div>
  );
}

