/**
 * Provisionamento automático de usuários de teste.
 *
 * Cria/recicla um admin e um representante usando o service role key e
 * exporta credenciais via variáveis de ambiente para a suíte de testes.
 *
 * Reduz a configuração de CI a três variáveis:
 *   SUPABASE_URL                 (ou VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEST_APP_URL                 (apenas para testes que chamam server fns)
 *
 * Variáveis populadas para os testes:
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD / TEST_ADMIN_ID
 *   TEST_REP_EMAIL   / TEST_REP_PASSWORD   / TEST_REP_ID
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PASSWORD = "TestPass!2026";
const RUN_ID = process.env.TEST_RUN_ID ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type Provisioned = {
  adminId: string;
  adminEmail: string;
  repId: string;
  repEmail: string;
  cleanup: () => Promise<void>;
};

function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  const id = data.user?.id;
  if (!id) throw new Error(`createUser(${email}): no id returned`);
  return id;
}

async function promoteToAdmin(admin: SupabaseClient, userId: string) {
  // O trigger handle_new_user já insere `representative`. Trocamos por `admin`.
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (error) throw new Error(`promoteToAdmin: ${error.message}`);
}

export async function provisionTestUsers(): Promise<Provisioned | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const adminEmail = `e2e-admin-${RUN_ID}@example.com`;
  const repEmail = `e2e-rep-${RUN_ID}@example.com`;

  const adminId = await createUser(admin, adminEmail, "E2E Admin");
  await promoteToAdmin(admin, adminId);
  const repId = await createUser(admin, repEmail, "E2E Representative");

  // Garantir que o login não cai na tela "alterar senha".
  await admin
    .from("profiles")
    .update({ must_change_password: false })
    .in("id", [adminId, repId]);

  const cleanup = async () => {
    for (const id of [adminId, repId]) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        /* best effort */
      }
    }
  };

  return { adminId, adminEmail, repId, repEmail, cleanup };
}

export function exportToEnv(p: Provisioned) {
  process.env.TEST_ADMIN_EMAIL = p.adminEmail;
  process.env.TEST_ADMIN_PASSWORD = PASSWORD;
  process.env.TEST_ADMIN_ID = p.adminId;
  process.env.TEST_REP_EMAIL = p.repEmail;
  process.env.TEST_REP_PASSWORD = PASSWORD;
  process.env.TEST_REP_ID = p.repId;
}
