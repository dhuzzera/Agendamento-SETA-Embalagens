import { createFileRoute } from "@tanstack/react-router";
import { CrmClientPage } from "@/features/crm/CrmClientPage";

export const Route = createFileRoute("/_app/crm/cliente/$id")({
  component: CrmClientPage,
});
