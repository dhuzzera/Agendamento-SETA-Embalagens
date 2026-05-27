import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MarketingHeader } from "@/features/marketing/MarketingHeader";

export const Route = createFileRoute("/_app/marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <>
      <MarketingHeader />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </>
  );
}
