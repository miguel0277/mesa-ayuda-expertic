import { expect, test } from "@playwright/test";
import { lastEmailLink, login, uniqueEmail } from "./helpers";

/**
 * Flujo completo: un estudiante se registra (sin aprobación, D-002), confirma su correo,
 * crea una solicitud y el docente la ve en la bandeja y la asigna.
 */
test("registro → verificación → solicitud → bandeja del docente", async ({ page, browser }) => {
  const email = uniqueEmail("estudiante");
  const password = "Hormiga-Azul-2026";
  const title = `Prueba E2E ${Date.now().toString(36)}`;

  // 1. Registro en tres pasos.
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Laura Prueba Automática");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repite la contraseña").fill(password);
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel(/^Estudiante/).check();
  await page.getByLabel(/Código UIS/).fill("2201234");
  await page.getByLabel("Programa o escuela").fill("Ingeniería de Sistemas");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel(/autorizo el tratamiento/i).check();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/\/verificar-correo/);

  // 2. Confirmación del correo con el enlace del buzón local.
  const link = await lastEmailLink(email, /confirma/i);
  await page.goto(link);

  // 3. Inicio de sesión y nueva solicitud.
  await login(page, email, password);
  await page.goto("/solicitudes/nueva");
  await page.getByRole("button", { name: /Otra solicitud/ }).click();
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Descripción")
    .fill("Necesito ayuda para entender cómo se calculan las notas del curso virtual.");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("heading", { name: "Recibimos tu solicitud" })).toBeVisible();
  const code = (await page.locator(".code-id").first().textContent())?.trim();
  expect(code).toMatch(/^EXP-\d{4}-\d{5}$/);

  // Registro de quién y cuándo (requisito 6).
  await page.getByRole("link", { name: "Ver la solicitud" }).click();
  await expect(page.getByText(/Creada por/)).toContainText("Laura Prueba Automática");
  await expect(page.getByText(/Creada por/)).toContainText(
    /\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} [ap]\. m\./,
  );

  // 4. El docente la ve en su bandeja.
  const docente = await browser.newPage();
  await login(docente, "docente@expertic.test");
  await docente.goto(`/panel/tickets?q=${encodeURIComponent(code ?? "")}`);
  await expect(docente.getByRole("link", { name: title })).toBeVisible();
  await docente.close();
});
