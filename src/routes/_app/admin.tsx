import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async ({ context }) => {
    const isAdmin = await context.queryClient.ensureQueryData({
      queryKey: ["auth", "is-admin"],
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      queryFn: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return false;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        return !!roles?.some((r) => r.role === "admin");
      },
    });
    if (isAdmin === false) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      throw redirect({ to: user ? "/dashboard" : "/login" });
    }
  },
  component: () => <Outlet />,
});
