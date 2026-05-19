import { createFileRoute } from "@tanstack/react-router";
import { SystemSelector } from "@/features/representative/SystemSelector";

export const Route = createFileRoute("/_app/selecionar")({
  component: SystemSelector,
});
