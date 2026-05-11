import { test, expect, type Page } from "@playwright/test";

/**
 * E2E authorization tests.
 *
 * Verifies that:
 *  1. Unauthenticated users hitting admin URLs are sent to /login.
 *  2. Authenticated non-admin (representative) users:
 *      - never see the "Usuários" admin nav link in the header,
 *      - are redirected to /dashboard when they hit any /admin/* URL directly,
 *      - see the representative dashboard (not the admin one) on /dashboard,
 *        even when forcing the admin "view mode" via localStorage.
 *  3. Admin users CAN reach /admin/usuarios and see the management UI.
 *
 * Credentials are read from environment variables. Tests that require a
 * specific role are skipped automatically when those credentials are absent,
 * so the suite stays green on machines without secrets.
 *
 * Required env vars:
 *   TEST_APP_URL          (defaults to http://localhost:3000)
 *   TEST_REP_EMAIL        — login of a non-admin (representante) user
 *   TEST_REP_PASSWORD
 *   TEST_ADMIN_EMAIL      — login of an admin user (optional, enables admin tests)
 *   TEST_ADMIN_PASSWORD
 */

const REP_EMAIL = process.env.TEST_REP_EMAIL;
const REP_PASSWORD = process.env.TEST_REP_PASSWORD;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const ADMIN_ROUTES = ["/admin/usuarios"] as const;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  // Wait until the auth-redirect lands on a logged-in route.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

test.describe("Unauthenticated access", () => {
  for (const route of ADMIN_ROUTES) {
    test(`redirects ${route} to /login when not signed in`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(page.url()).toContain("/login");
    });
  }
});

test.describe("Representative (non-admin) access", () => {
  test.skip(
    !REP_EMAIL || !REP_PASSWORD,
    "Set TEST_REP_EMAIL and TEST_REP_PASSWORD to run representative E2E tests.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
  });

  test("does not show admin nav link in the header", async ({ page }) => {
    await page.goto("/dashboard");
    const adminLink = page.getByRole("link", { name: /usu[áa]rios/i });
    await expect(adminLink).toHaveCount(0);
  });

  for (const route of ADMIN_ROUTES) {
    test(`is redirected away from ${route} to /dashboard`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/dashboard$/);
      // No admin-only UI must be visible.
      await expect(
        page.getByRole("heading", { name: /gerenciar usu[áa]rios/i }),
      ).toHaveCount(0);
    });
  }

  test("dashboard renders representative view even when admin mode is forced", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => {
      try {
        window.localStorage.setItem("seta:view-mode", "admin");
      } catch {
        /* ignore */
      }
    });
    await page.reload();
    // Admin-only widgets must NOT appear.
    await expect(
      page.getByRole("heading", { name: /m[ée]tricas mensais/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /gerenciar usu[áa]rios/i }),
    ).toHaveCount(0);
  });
});

test.describe("Admin access", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run admin E2E tests.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  });

  test("can open /admin/usuarios", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await page.waitForURL(/\/admin\/usuarios/, { timeout: 10_000 });
    expect(page.url()).toContain("/admin/usuarios");
  });
});
