import { createFileRoute } from "@tanstack/react-router";
import { MarketingScoring } from "@/features/marketing/MarketingScoring";

export const Route = createFileRoute("/_app/marketing/scoring")({
  component: MarketingScoring,
});
