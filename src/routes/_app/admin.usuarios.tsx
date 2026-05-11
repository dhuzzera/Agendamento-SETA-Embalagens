import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { UserManagement } from "@/features/admin/UserManagement";

export const Route = createFileRoute("/_app/admin/usuarios")({
  component: UsersPage,
});

function UsersPage() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;
  return <UserManagement />;
}
