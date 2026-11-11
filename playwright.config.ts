import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas E2E contra el build de producción (`next start`) y la base de datos de .env.local
 * (rama de desarrollo de Neon con la semilla cargada: `pnpm db:seed --reset`).
 *
 * - Los correos salen por ConsoleEmail a `.data/correos/<correo>.json`: de ahí se toma el
 *   enlace de verificación.
 * - `E2E_RELAXED_RATE_LIMIT=1` sube el límite de inicios de sesión por minuto (las pruebas
 *   entran con varios roles seguidos). El entorno lo rechaza en producción de Vercel.
 * - Usa el Chrome instalado (`channel: "chrome"`); en CI: `pnpm exec playwright install chromium`
 *   y quita `channel`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: ".data/e2e-resultados",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
    {
      name: "movil",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { E2E_RELAXED_RATE_LIMIT: "1", PORT: String(PORT) },
  },
});
