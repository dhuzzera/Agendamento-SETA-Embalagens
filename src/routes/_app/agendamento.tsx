import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { RepDashboard } from "@/features/representative/RepDashboard";
import { StatCardsRowSkeleton } from "@/components/Skeletons";

// AdminDashboard puxa MonthlyMetrics e dependências de admin — só carregar
// sob demanda, quando um admin de fato escolher visualizar o painel admin.
const AdminDashboard = lazy(() =>
  import("@/features/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);

export const Route = createFileRoute("/_app/agendamento")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role } = useAuth();
  const [mode] = useViewMode();
  // Não-admin nunca vê o painel administrativo, mesmo que force "mode=admin".
  if (role !== "admin") return <RepDashboard />;
  if (mode === "representative") return <RepDashboard />;
  return (
    <Suspense fallback={<StatCardsRowSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
