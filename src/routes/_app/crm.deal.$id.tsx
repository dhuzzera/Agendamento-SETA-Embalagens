import { createFileRoute } from "@tanstack/react-router";
import { CrmDealPage } from "@/features/crm/CrmDealPage";

export const Route = createFileRoute("/_app/crm/deal/$id")({
  component: CrmDealPage,
});
