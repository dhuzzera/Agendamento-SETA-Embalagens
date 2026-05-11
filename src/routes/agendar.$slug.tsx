import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/agendar/$slug")({
  component: RedirectToShortLink,
});

function RedirectToShortLink() {
  const { slug } = Route.useParams();
  return <Navigate to="/$slug" params={{ slug }} replace />;
}
