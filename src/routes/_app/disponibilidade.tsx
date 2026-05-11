import { createFileRoute } from "@tanstack/react-router";
import { AvailabilityManager } from "@/features/representative/AvailabilityManager";

export const Route = createFileRoute("/_app/disponibilidade")({
  component: AvailabilityManager,
});
