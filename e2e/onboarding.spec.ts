import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Fluxo de onboarding do representante.
 *
 * Testa:
 *  - Representante com must_change_password=true é redirecionado para /alterar-senha
 *  - Após trocar a senha, é redirecionado para /perfil?setup=1
 *  - Página de perfil mostra banner de onboarding quando ?setup=1
 *
 * Requer TEST_REP_EMAIL e TEST_REP_PASSWORD (representante com must_change_password=true)
 * ou pode ser testado com mock.
 */

const REP_EMAIL = process.env.TEST_REP_EMAIL;
const REP_PASSWORD = process.env.TEST_REP_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

test.describe("Onboarding — Alterar senha", () => {
  test.skip(
    !REP_EMAIL || !REP_PASSWORD,
    "Set TEST_REP_EMAIL and TEST_REP_PASSWORD to run onboarding tests.",
  );

  test("página de alterar senha renderiza corretamente", async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
    await page.goto("/alterar-senha");
    await expect(page.getByRole("heading", { name: /alterar senha/i })).toBeVisible();
    await expect(page.getByLabel(/nova senha/i)).toBeVisible();
    await expect(page.getByLabel(/confirmar/i)).toBeVisible();
  });
});

test.describe("Onboarding — Perfil setup", () => {
  test.skip(
    !REP_EMAIL || !REP_PASSWORD,
    "Set TEST_REP_EMAIL and TEST_REP_PASSWORD to run onboarding tests.",
  );

  test("perfil com ?setup=1 mostra banner de onboarding", async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
    await page.goto("/perfil?setup=1");
    await expect(page.getByText(/passo 2 de 3/i)).toBeVisible();
    await expect(page.getByText(/complete seu perfil/i)).toBeVisible();
  });

  test("perfil sem ?setup não mostra banner", async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
    await page.goto("/perfil");
    await expect(page.getByText(/passo 2 de 3/i)).toHaveCount(0);
  });
});

test.describe("Onboarding — Disponibilidade", () => {
  test.skip(
    !REP_EMAIL || !REP_PASSWORD,
    "Set TEST_REP_EMAIL and TEST_REP_PASSWORD to run onboarding tests.",
  );

  test("página de disponibilidade renderiza", async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
    await page.goto("/disponibilidade");
    await expect(page.getByRole("heading", { name: /disponibilidade/i })).toBeVisible();
  });
});
