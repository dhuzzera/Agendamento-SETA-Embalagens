import { createFileRoute } from "@tanstack/react-router";
import { PublicBooking } from "@/features/public/PublicBooking";

export const Route = createFileRoute("/$slug")({
  component: PublicBookingPage,
});

function PublicBookingPage() {
  const { slug } = Route.useParams();
  return <PublicBooking slug={slug} />;
}
