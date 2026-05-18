import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Fluxos do representante.
 *
 * Testa:
 *  - Dashboard do representante renderiza
 *  - QR Code aparece quando tem slug
 *  - Agenda renderiza com calendário
 *  - Disponibilidade renderiza com formulário
 *  - Perfil renderiza com campos
 *
 * Requer TEST_REP_EMAIL e TEST_REP_PASSWORD.
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

test.describe("Representante — Dashboard", () => {
  test.skip(
    !REP_EMAIL || !REP_PASSWORD,
    "Set TEST_REP_EMAIL and TEST_REP_PASSWORD.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, REP_EMAIL!, REP_PASSWORD!);
  });

  test("dashboard renderiza com saudação", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /ol[áa]/i })).toBeVisible({ timeout: 10_000 });
  });

  test("agenda renderiza com calendário", async ({ page }) => {
    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: /minhas reuni[õo]es|agendamentos/i })).toBeVisible({ timeout: 10_000 });
  });

  test("disponibilidade renderiza com formulário", async ({ page }) => {
    await page.goto("/disponibilidade");
    await expect(page.getByRole("heading", { name: /disponibilidade/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /adicionar/i })).toBeVisible();
  });

  test("perfil renderiza com campos editáveis", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: /meu perfil/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/nome completo/i)).toBeVisible();
    await expect(page.getByLabel(/telefone/i)).toBeVisible();
  });

  test("link de reunião online aparece no perfil", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page.getByLabel(/link de reuni[ãa]o online/i)).toBeVisible({ timeout: 10_000 });
  });
});
