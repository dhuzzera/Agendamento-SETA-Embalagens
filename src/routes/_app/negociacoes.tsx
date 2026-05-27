import { createFileRoute } from "@tanstack/react-router";
import { NegotiationsList } from "@/features/representative/NegotiationsList";

export const Route = createFileRoute("/_app/negociacoes")({
  component: NegotiationsList,
});
