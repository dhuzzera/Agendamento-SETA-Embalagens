import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { RepDashboard } from "@/features/representative/RepDashboard";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role } = useAuth();
  return role === "admin" ? <AdminDashboard /> : <RepDashboard />;
}
