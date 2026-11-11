import { expect, test } from "@playwright/test";
import { login, SEED_PASSWORD, SEED_USERS } from "./helpers";

/** Control de acceso por rol (RBAC) aplicado en el proxy y en las páginas. */
test.describe("Control de acceso", () => {
  test("sin sesión, una ruta privada lleva al inicio de sesión y recuerda a dónde volver", async ({
    page,
  }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login\?volver=%2Fpanel/);
  });

  test("un estudiante recibe 403 en el panel del docente", async ({ page }) => {
    await login(page, SEED_USERS.estudiante);
    const res = await page.goto("/panel");
    expect(res?.status()).toBe(403);
    await expect(page.getByText(/no está disponible para tu rol/i)).toBeVisible();
  });

  test("si la página de regreso no es de su rol, entra a su inicio (no a un 403)", async ({
    page,
  }) => {
    await page.goto("/login?volver=%2Ftareas");
    await page.getByLabel("Correo").fill(SEED_USERS.docente);
    await page.getByLabel("Contraseña", { exact: true }).fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/panel$/);
  });

  test("si la página de regreso sí es de su rol, vuelve a ella", async ({ page }) => {
    await page.goto("/login?volver=%2Fpanel%2Ftickets");
    await page.getByLabel("Correo").fill(SEED_USERS.docente);
    await page.getByLabel("Contraseña", { exact: true }).fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/panel\/tickets$/);
  });

  test("un auxiliar recibe 403 en la administración", async ({ page }) => {
    await login(page, SEED_USERS.auxiliar);
    const res = await page.goto("/admin/usuarios");
    expect(res?.status()).toBe(403);
  });

  test("credenciales inválidas muestran un mensaje genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill(SEED_USERS.docente);
    await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator("[data-slot=alert]")).toContainText(/correo o la contraseña/i);
  });

  for (const [rol, email, home] of [
    ["docente", SEED_USERS.docente, /\/panel/],
    ["líder", SEED_USERS.lider, /\/(inicio|equipo|tareas)/],
    ["auxiliar", SEED_USERS.auxiliar, /\/(inicio|tareas)/],
    ["profesor", SEED_USERS.profesor, /\/(inicio|solicitudes)/],
  ] as const) {
    test(`el ${rol} entra y ve su inicio`, async ({ page }) => {
      await login(page, email);
      await expect(page).toHaveURL(home);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});
