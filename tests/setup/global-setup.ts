import { provisionTestUsers, exportToEnv, type Provisioned } from "./test-users";

let provisioned: Provisioned | null = null;

export async function setup() {
  provisioned = await provisionTestUsers();
  if (provisioned) {
    exportToEnv(provisioned);
    // eslint-disable-next-line no-console
    console.log(
      `[vitest] provisioned admin=${provisioned.adminEmail} rep=${provisioned.repEmail}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      "[vitest] SUPABASE_SERVICE_ROLE_KEY ausente — testes de API serão pulados.",
    );
  }
}

export async function teardown() {
  if (provisioned) await provisioned.cleanup();
}
