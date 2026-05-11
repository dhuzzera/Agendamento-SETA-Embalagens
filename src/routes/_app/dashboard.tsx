import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { RepDashboard } from "@/features/representative/RepDashboard";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role } = useAuth();
  const [mode] = useViewMode();
  if (role !== "admin") return <RepDashboard />;
  return mode === "representative" ? <RepDashboard /> : <AdminDashboard />;
}
