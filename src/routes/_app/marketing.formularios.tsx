import { createFileRoute } from "@tanstack/react-router";
import { MarketingForms } from "@/features/marketing/MarketingForms";

export const Route = createFileRoute("/_app/marketing/formularios")({
  component: MarketingForms,
});
