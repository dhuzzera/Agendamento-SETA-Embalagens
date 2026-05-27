import { createFileRoute } from "@tanstack/react-router";
import { MarketingLists } from "@/features/marketing/MarketingLists";

export const Route = createFileRoute("/_app/marketing/listas")({
  component: MarketingLists,
});
