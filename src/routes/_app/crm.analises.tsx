import { createFileRoute } from "@tanstack/react-router";
import { CrmAnalytics } from "@/features/crm/CrmAnalytics";

export const Route = createFileRoute("/_app/crm/analises")({
  component: CrmAnalytics,
});
