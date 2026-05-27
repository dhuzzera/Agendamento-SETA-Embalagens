import { createFileRoute } from "@tanstack/react-router";
import { CrmDuplicates } from "@/features/crm/CrmDuplicates";

export const Route = createFileRoute("/_app/crm/duplicados")({
  component: CrmDuplicates,
});
