import { createLazyFileRoute, getRouteApi } from "@tanstack/react-router";
import { PublicBooking } from "@/features/public/PublicBooking";

const routeApi = getRouteApi("/$slug");

export const Route = createLazyFileRoute("/$slug")({
  component: PublicBookingPage,
});

function PublicBookingPage() {
  const { slug } = routeApi.useParams();
  return <PublicBooking slug={slug} />;
}
