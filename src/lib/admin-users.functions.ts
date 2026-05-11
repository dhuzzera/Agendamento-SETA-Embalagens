import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { holidaysBetween } from "@/lib/holidays";

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/)
    .max(60)
    .optional()
    .nullable(),
  role: z.enum(["admin", "representative"]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rErr) throw new Error(rErr.message);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Falha ao criar usuário");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        slug: data.slug ?? null,
        must_change_password: true,
      })
      .eq("id", uid);

    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: uid, role: "admin" });
    } else {
      // Representante novo: padroniza horários (Seg–Sex 07:00–18:00, 60 min)
      // e bloqueia feriados nacionais dos próximos 12 meses.
      const standardAvails = [1, 2, 3, 4, 5].map((weekday) => ({
        representative_id: uid,
        weekday,
        start_time: "07:00:00",
        end_time: "18:00:00",
        meeting_duration_min: 60,
        active: true,
      }));
      await supabaseAdmin.from("availabilities").insert(standardAvails);

      const today = new Date();
      const yearAhead = new Date(today);
      yearAhead.setFullYear(today.getFullYear() + 1);
      const holidays = holidaysBetween(today, yearAhead);
      if (holidays.length > 0) {
        await supabaseAdmin.from("blocks").insert(
          holidays.map((h) => ({
            representative_id: uid,
            block_date: h.date,
            start_time: null,
            end_time: null,
            reason: `Feriado nacional: ${h.name}`,
          })),
        );
      }
    }

    return { id: uid };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (data.id === context.userId) {
      throw new Error("Você não pode excluir a própria conta");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
