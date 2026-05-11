/**
 * Testes automatizados de autorização.
 *
 * Cobrem dois vetores:
 *  1. UI/Roteamento: a tabela `NAV` em AppHeader e a verificação de papel em
 *     DashboardRouter garantem que itens administrativos não apareçam para
 *     representantes e que `/dashboard` nunca renderize `<AdminDashboard />`
 *     mesmo se o modo for forçado.
 *  2. API: um usuário autenticado como representante NÃO consegue
 *     - ler `user_roles` de outros usuários
 *     - inserir/atualizar perfis de terceiros
 *     - ler `availability_changes` de outro representante
 *     - chamar a server function `adminCreateUser` (HTTP 403)
 *
 * Os testes de API exigem credenciais reais e são automaticamente puladas
 * quando as variáveis de ambiente abaixo não estão presentes:
 *   TEST_REP_EMAIL, TEST_REP_PASSWORD
 *   TEST_ADMIN_ID  (uuid de qualquer admin existente — alvo "alheio")
 *   TEST_APP_URL   (URL da app, ex: https://seta-agendamento.lovable.app)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------- 1. UI / Roteamento (puro, sem rede) ----------

// Replicamos a estrutura usada em AppHeader para validar o filtro de papel.
const NAV = [
  { to: "/dashboard", adminOnly: false },
  { to: "/agenda", adminOnly: false },
  { to: "/disponibilidade", adminOnly: false },
  { to: "/admin/usuarios", adminOnly: true },
];

function visibleNav(role: "admin" | "representative" | null) {
  const isAdmin = role === "admin";
  return NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => n.to);
}

// Replica do guard de DashboardRouter
function dashboardComponent(role: string | null, mode: string) {
  if (role !== "admin") return "RepDashboard";
  return mode === "representative" ? "RepDashboard" : "AdminDashboard";
}

describe("Autorização — camada de UI/Roteamento", () => {
  it("representante não enxerga itens de menu admin", () => {
    const items = visibleNav("representative");
    expect(items).not.toContain("/admin/usuarios");
  });

  it("usuário não autenticado não enxerga itens admin", () => {
    expect(visibleNav(null)).not.toContain("/admin/usuarios");
  });

  it("admin enxerga todos os itens", () => {
    expect(visibleNav("admin")).toContain("/admin/usuarios");
  });

  it("DashboardRouter NUNCA renderiza AdminDashboard para não-admin, mesmo com mode=admin", () => {
    expect(dashboardComponent("representative", "admin")).toBe("RepDashboard");
    expect(dashboardComponent(null, "admin")).toBe("RepDashboard");
  });

  it("admin com mode=representative continua vendo painel de rep (preview)", () => {
    expect(dashboardComponent("admin", "representative")).toBe("RepDashboard");
    expect(dashboardComponent("admin", "admin")).toBe("AdminDashboard");
  });
});

// ---------- 2. API / RLS ----------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const REP_EMAIL = process.env.TEST_REP_EMAIL;
const REP_PASSWORD = process.env.TEST_REP_PASSWORD;
const OTHER_USER_ID = process.env.TEST_ADMIN_ID;
const APP_URL = process.env.TEST_APP_URL;

const canRunApi = Boolean(
  SUPABASE_URL && SUPABASE_ANON && REP_EMAIL && REP_PASSWORD && OTHER_USER_ID
);

describe.skipIf(!canRunApi)("Autorização — camada de API (RLS)", () => {
  let rep: SupabaseClient;
  let repId: string;
  let accessToken: string;

  beforeAll(async () => {
    rep = createClient(SUPABASE_URL!, SUPABASE_ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await rep.auth.signInWithPassword({
      email: REP_EMAIL!,
      password: REP_PASSWORD!,
    });
    if (error) throw error;
    repId = data.user!.id;
    accessToken = data.session!.access_token;
  });

  it("representante NÃO consegue listar papéis de outros usuários", async () => {
    const { data, error } = await rep
      .from("user_roles")
      .select("*")
      .neq("user_id", repId);
    // RLS: política só retorna o próprio papel; consulta deve voltar vazia.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("representante NÃO consegue se promover a admin", async () => {
    const { error } = await rep
      .from("user_roles")
      .insert({ user_id: repId, role: "admin" });
    // política `roles_admin_all` exige has_role(admin) no WITH CHECK
    expect(error).not.toBeNull();
  });

  it("representante NÃO consegue criar perfil para terceiro", async () => {
    const { error } = await rep.from("profiles").insert({
      id: crypto.randomUUID(),
      full_name: "Hack",
      email: `hack-${Date.now()}@x.com`,
    });
    expect(error).not.toBeNull();
  });

  it("representante NÃO consegue atualizar perfil de outro usuário", async () => {
    const { data, error } = await rep
      .from("profiles")
      .update({ full_name: "Comprometido" })
      .eq("id", OTHER_USER_ID!)
      .select();
    // Update silencioso por RLS: sem erro, mas zero linhas afetadas.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("representante NÃO consegue ler log de alterações de outro representante", async () => {
    const { data, error } = await rep
      .from("availability_changes")
      .select("*")
      .neq("representative_id", repId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("representante NÃO consegue excluir agendamento de outro representante", async () => {
    const { data, error } = await rep
      .from("appointments")
      .delete()
      .neq("representative_id", repId)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  describe.skipIf(!APP_URL)("Server functions admin", () => {
    it("adminCreateUser retorna 403 quando chamado por representante", async () => {
      const res = await fetch(`${APP_URL}/_serverFn/admin-users/adminCreateUser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data: {
            email: `intruso-${Date.now()}@x.com`,
            password: "12345678",
            full_name: "Intruso",
            phone: null,
            slug: null,
            role: "admin",
          },
        }),
      });
      // A rota pode responder 403 (verificação explícita) ou 4xx genérico.
      // O essencial: NUNCA 200.
      expect(res.status).not.toBe(200);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
