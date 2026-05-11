import { test, expect, type Page } from "@playwright/test";

/**
 * E2E positivo — Admin.
 *
 * Verifica que um usuário admin consegue:
 *  - ver o link "Usuários" no header
 *  - abrir /admin/usuarios e ver a UI de gerenciamento
 *  - ver o painel admin em /dashboard (incluindo o gráfico mensal)
 *  - abrir o diálogo "Novo usuário" e criar um representante via UI
 *
 * Pulado quando faltam TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD.
 */

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

test.describe("Admin — fluxos positivos", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD para rodar os testes positivos do admin.",
  );

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  });

  test("vê link 'Usuários' no header", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: /usu[áa]rios/i }).first(),
    ).toBeVisible();
  });

  test("acessa /admin/usuarios e vê a UI de gerenciamento", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await page.waitForURL(/\/admin\/usuarios/, { timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /novo usu[áa]rio/i }),
    ).toBeVisible();
  });

  test("dashboard renderiza painel admin com métricas", async ({ page }) => {
    await page.goto("/dashboard");
    // Toggle de modo só existe para admin
    await expect(
      page.getByRole("heading", { name: /m[ée]tricas mensais/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("cria um novo representante via UI", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await page.getByRole("button", { name: /novo usu[áa]rio/i }).click();

    const email = `e2e-ui-${Date.now()}@example.com`;
    await page.getByLabel(/nome completo/i).fill("E2E UI Rep");
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/senha/i).fill("Provis@123");

    // Confirma criação
    await page.getByRole("button", { name: /^criar$|^salvar$|cadastrar/i }).click();

    // Após criação, o diálogo deve fechar e o e-mail deve aparecer na lista.
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });
});
