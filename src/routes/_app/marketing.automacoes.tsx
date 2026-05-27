import { createFileRoute } from "@tanstack/react-router";
import { MarketingAutomations } from "@/features/marketing/MarketingAutomations";

export const Route = createFileRoute("/_app/marketing/automacoes")({
  component: MarketingAutomations,
});
