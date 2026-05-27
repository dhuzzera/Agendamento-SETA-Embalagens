import { createFileRoute } from "@tanstack/react-router";
import { MarketingDashboard } from "@/features/marketing/MarketingDashboard";

export const Route = createFileRoute("/_app/marketing/")({
  component: MarketingDashboard,
});
