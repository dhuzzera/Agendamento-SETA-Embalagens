import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CrmHeader } from "@/features/crm/CrmHeader";

export const Route = createFileRoute("/_app/crm")({
  component: CrmLayout,
});

function CrmLayout() {
  return (
    <>
      <CrmHeader />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </>
  );
}
