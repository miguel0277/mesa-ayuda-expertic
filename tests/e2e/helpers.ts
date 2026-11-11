import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/** Contraseña de todos los usuarios de la semilla. */
export const SEED_PASSWORD = "ExperTIC-2026*";

export const SEED_USERS = {
  docente: "docente@expertic.test",
  lider: "lider1@expertic.test",
  auxiliar: "aux1@expertic.test",
  profesor: "profesor1@expertic.test",
  estudiante: "estudiante1@expertic.test",
} as const;

export async function login(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

type MailboxEntry = { subject: string; links: string[]; sentAt: string };

/** Lee el buzón local de ConsoleEmail y devuelve el primer enlace del correo más reciente. */
export async function lastEmailLink(email: string, subject: RegExp, timeoutMs = 15_000) {
  const file = path.join(process.cwd(), ".data", "correos", `${email.toLowerCase()}.json`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const entries = JSON.parse(await readFile(file, "utf8")) as MailboxEntry[];
      const hit = entries.find((e) => subject.test(e.subject));
      if (hit?.links[0]) return hit.links[0];
    } catch {
      // Aún no llega.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No llegó un correo "${subject}" a ${email}`);
}

/** Correo único por ejecución (los dominios son libres, D-001). */
export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now().toString(36)}@e2e.expertic.test`;
}
