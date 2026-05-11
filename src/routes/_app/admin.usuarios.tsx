import { createFileRoute } from "@tanstack/react-router";
import { UserManagement } from "@/features/admin/UserManagement";

export const Route = createFileRoute("/_app/admin/usuarios")({
  component: UserManagement,
});
