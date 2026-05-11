import { createFileRoute } from "@tanstack/react-router";
import { AppointmentsList } from "@/features/representative/AppointmentsList";

export const Route = createFileRoute("/_app/agenda")({
  component: AppointmentsList,
});
