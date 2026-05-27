import { createFileRoute } from "@tanstack/react-router";
import { MarketingCampaigns } from "@/features/marketing/MarketingCampaigns";

export const Route = createFileRoute("/_app/marketing/campanhas")({
  component: MarketingCampaigns,
});
