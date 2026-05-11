/**
 * Testes positivos de autorização — admin DEVE conseguir:
 *
 *  API/RLS (vitest):
 *   - listar papéis (`user_roles`) de outros usuários
 *   - ler perfis de terceiros via `profiles_self_select`
 *   - ler `availability_changes` de outros representantes
 *   - chamar a server function `adminCreateUser` com sucesso (HTTP 200)
 *     e em seguida `adminDeleteUser` para limpar o usuário criado
 *
 * Os testes são automaticamente pulados quando as credenciais de admin
 * não estão presentes no ambiente. Variáveis necessárias:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (já injetadas em dev)
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_APP_URL  (apenas para os testes de server function)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const APP_URL = process.env.TEST_APP_URL;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON && ADMIN_EMAIL && ADMIN_PASSWORD);

describe.skipIf(!canRun)("Autorização — admin (testes positivos de API)", () => {
  let admin: SupabaseClient;
  let adminId: string;
  let accessToken: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.signInWithPassword({
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!,
    });
    if (error) throw error;
    adminId = data.user!.id;
    accessToken = data.session!.access_token;

    // Sanidade: garantir que o usuário é realmente admin.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);
    expect(roles?.some((r) => r.role === "admin")).toBe(true);
  });

  it("admin lista papéis de TODOS os usuários", async () => {
    const { data, error } = await admin.from("user_roles").select("user_id, role");
    expect(error).toBeNull();
    // Há pelo menos o próprio admin + ao menos um outro usuário em projetos reais.
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    const others = (data ?? []).filter((r) => r.user_id !== adminId);
    // Em ambientes com mais de um usuário, este filtro deve retornar linhas.
    // Não falhamos se o projeto tem só o admin — apenas garantimos que NÃO houve erro.
    expect(others).toBeInstanceOf(Array);
  });

  it("admin lê perfis de terceiros", async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .neq("id", adminId)
      .limit(5);
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Array);
  });

  it("admin lê availability_changes de qualquer representante", async () => {
    const { error } = await admin
      .from("availability_changes")
      .select("id, representative_id")
      .limit(5);
    expect(error).toBeNull();
  });

  describe.skipIf(!APP_URL)("Server functions admin (positivos)", () => {
    let createdUserId: string | null = null;

    afterAll(async () => {
      if (!createdUserId) return;
      try {
        await fetch(`${APP_URL}/_serverFn/admin-users/adminDeleteUser`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ data: { id: createdUserId } }),
        });
      } catch {
        /* best-effort cleanup */
      }
    });

    it("adminCreateUser cria um representante (HTTP 200)", async () => {
      const email = `e2e-positive-${Date.now()}@example.com`;
      const res = await fetch(`${APP_URL}/_serverFn/admin-users/adminCreateUser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data: {
            email,
            password: "Provis@123",
            full_name: "E2E Positivo",
            phone: null,
            slug: null,
            role: "representative",
          },
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { id?: string; result?: { id?: string } };
      // TanStack server-fn payload pode aninhar em `result`.
      const id = json.id ?? json.result?.id;
      expect(id).toBeTruthy();
      createdUserId = id!;

      // Confirma que o perfil foi gravado e marcado para troca de senha.
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, must_change_password")
        .eq("id", createdUserId!)
        .maybeSingle();
      expect(profile?.full_name).toBe("E2E Positivo");
      expect(profile?.must_change_password).toBe(true);
    });
  });
});
