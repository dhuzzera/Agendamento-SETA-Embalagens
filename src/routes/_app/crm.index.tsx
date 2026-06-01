import { createFileRoute } from "@tanstack/react-router";
import { CrmDashboard } from "@/features/crm/CrmDashboard";

export const Route = createFileRoute("/_app/crm/")({
  component: CrmDashboard,
});
