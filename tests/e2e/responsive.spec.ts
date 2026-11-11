import { expect, test } from "@playwright/test";
import { login, SEED_USERS } from "./helpers";

/** En móvil ninguna pantalla principal debe desbordar en horizontal. */
const PAGES: [string, string, string[]][] = [
  [
    "docente",
    SEED_USERS.docente,
    ["/panel", "/panel/tickets", "/panel/tareas", "/panel/plantillas"],
  ],
  ["auxiliar", SEED_USERS.auxiliar, ["/inicio", "/tareas", "/tickets-asignados", "/perfil"]],
  ["estudiante", SEED_USERS.estudiante, ["/inicio", "/solicitudes", "/solicitudes/nueva"]],
];

for (const [rol, email, paths] of PAGES) {
  test(`sin scroll horizontal en móvil (${rol})`, async ({ page }) => {
    await login(page, email);
    for (const p of paths) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { overflow, culprit } = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        // El elemento más profundo que se sale del viewport, para saber qué arreglar.
        const out = [...document.querySelectorAll<HTMLElement>("main *")].filter(
          (el) => el.getBoundingClientRect().right > vw + 1,
        );
        const leaf = out.find((el) => !out.some((o) => o !== el && el.contains(o)));
        return {
          overflow: document.documentElement.scrollWidth - vw,
          culprit: leaf ? `${leaf.tagName.toLowerCase()}.${leaf.className}`.slice(0, 160) : "",
        };
      });
      expect(overflow, `desborde en ${p}: ${culprit}`).toBeLessThanOrEqual(0);
    }
  });
}
