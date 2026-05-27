import { createFileRoute } from "@tanstack/react-router";
import { CrmContacts } from "@/features/crm/CrmContacts";

export const Route = createFileRoute("/_app/crm/contatos")({
  component: CrmContacts,
});
