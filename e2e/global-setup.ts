import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { provisionTestUsers, exportToEnv } from "../tests/setup/test-users";

const STATE_FILE = resolve(".playwright/users.json");

export default async function globalSetup() {
  const provisioned = await provisionTestUsers();
  if (!provisioned) {
    // eslint-disable-next-line no-console
    console.log(
      "[playwright] SUPABASE_SERVICE_ROLE_KEY ausente — testes que precisam de login serão pulados.",
    );
    return;
  }
  exportToEnv(provisioned);
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        adminId: provisioned.adminId,
        adminEmail: provisioned.adminEmail,
        adminPassword: process.env.TEST_ADMIN_PASSWORD,
        repId: provisioned.repId,
        repEmail: provisioned.repEmail,
        repPassword: process.env.TEST_REP_PASSWORD,
      },
      null,
      2,
    ),
  );
  // eslint-disable-next-line no-console
  console.log(
    `[playwright] provisioned admin=${provisioned.adminEmail} rep=${provisioned.repEmail}`,
  );
}
