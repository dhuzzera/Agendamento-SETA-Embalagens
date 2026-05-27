import { createFileRoute } from "@tanstack/react-router";
import { MarketingTemplates } from "@/features/marketing/MarketingTemplates";

export const Route = createFileRoute("/_app/marketing/templates")({
  component: MarketingTemplates,
});
