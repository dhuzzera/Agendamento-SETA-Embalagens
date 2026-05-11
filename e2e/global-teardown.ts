import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const STATE_FILE = resolve(".playwright/users.json");

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
    adminId: string;
    repId: string;
  };
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const id of [state.adminId, state.repId]) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      /* best effort */
    }
  }
  try {
    rmSync(STATE_FILE);
  } catch {
    /* ignore */
  }
}
