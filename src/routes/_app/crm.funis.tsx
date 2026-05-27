import { createFileRoute } from "@tanstack/react-router";
import { CrmPipelines } from "@/features/crm/CrmPipelines";

export const Route = createFileRoute("/_app/crm/funis")({
  component: CrmPipelines,
});
