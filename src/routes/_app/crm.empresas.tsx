import { createFileRoute } from "@tanstack/react-router";
import { CrmCompanies } from "@/features/crm/CrmCompanies";

export const Route = createFileRoute("/_app/crm/empresas")({
  component: CrmCompanies,
});
