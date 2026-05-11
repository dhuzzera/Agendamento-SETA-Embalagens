import { createFileRoute } from "@tanstack/react-router";
import { PerformanceDashboard } from "@/features/admin/PerformanceDashboard";

export const Route = createFileRoute("/_app/admin/performance")({
  component: PerformanceDashboard,
});
