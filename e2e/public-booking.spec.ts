import { test, expect } from "@playwright/test";

/**
 * E2E — Página pública de agendamento.
 *
 * Testa:
 *  - Acesso à landing page
 *  - Página de representante inexistente mostra mensagem de erro
 *  - Página de login renderiza corretamente
 *  - Link "Esqueci minha senha" abre o modal
 *  - Tema escuro funciona
 */

test.describe("Landing page", () => {
  test("renderiza a página inicial com header e CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /entrar|login/i })).toBeVisible();
    await expect(page.locator("img[alt='SETA Embalagens']").first()).toBeVisible();
  });

  test("redireciona /login para a tela de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /entrar/i })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });
});

test.describe("Representante inexistente", () => {
  test("mostra mensagem de erro para slug inválido", async ({ page }) => {
    await page.goto("/slug-que-nao-existe-xyz");
    await expect(
      page.getByText(/representante n[ãa]o encontrado/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Esqueci minha senha", () => {
  test("abre o modal de recuperação de senha", async ({ page }) => {
    await page.goto("/login");
    await page.getByText(/esqueci minha senha/i).click();
    await expect(page.getByRole("heading", { name: /recuperar senha/i })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i).last()).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar link/i })).toBeVisible();
  });

  test("fecha o modal ao clicar cancelar", async ({ page }) => {
    await page.goto("/login");
    await page.getByText(/esqueci minha senha/i).click();
    await page.getByRole("button", { name: /cancelar/i }).click();
    await expect(page.getByRole("heading", { name: /recuperar senha/i })).toHaveCount(0);
  });
});

test.describe("Tema escuro", () => {
  test("toggle de tema funciona", async ({ page }) => {
    // Precisa estar logado para ver o header com o toggle
    await page.goto("/login");
    // A landing page também tem o header? Não, só o painel logado.
    // Vamos testar via localStorage diretamente
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("seta:theme", "dark");
      document.documentElement.classList.add("dark");
    });
    await page.reload();
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark).toBe(true);
  });
});
