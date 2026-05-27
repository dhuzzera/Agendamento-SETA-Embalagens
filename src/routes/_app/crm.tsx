import { createFileRoute } from "@tanstack/react-router";
import { CrmKanban } from "@/features/crm/CrmKanban";

export const Route = createFileRoute("/_app/crm")({
  component: CrmKanban,
});
