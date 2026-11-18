import { describe, expect, it } from "vitest";
import { parseEnv, serverEnvSchema } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/db?sslmode=require",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/db?sslmode=require",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("env", () => {
  it("acepta una configuración mínima y aplica valores por defecto", () => {
    const env = parseEnv(serverEnvSchema, valid);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.EMAIL_DRIVER).toBe("console");
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual([]); // D-001: cualquier dominio
  });

  it("convierte la lista de dominios separada por comas", () => {
    const env = parseEnv(serverEnvSchema, {
      ...valid,
      ALLOWED_EMAIL_DOMAINS: " UIS.edu.co, correo.uis.edu.co ,",
    });
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual(["uis.edu.co", "correo.uis.edu.co"]);
  });

  it("falla con un mensaje claro en español si falta la base de datos", () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(serverEnvSchema, rest)).toThrow(/DATABASE_URL/);
    expect(() => parseEnv(serverEnvSchema, rest)).toThrow(/\.env\.local/);
  });

  it("exige el token de Blob cuando STORAGE_DRIVER=vercel-blob", () => {
    expect(() => parseEnv(serverEnvSchema, { ...valid, STORAGE_DRIVER: "vercel-blob" })).toThrow(
      /BLOB_READ_WRITE_TOKEN/,
    );
  });

  it("exige la clave de Brevo cuando EMAIL_DRIVER=brevo", () => {
    expect(() => parseEnv(serverEnvSchema, { ...valid, EMAIL_DRIVER: "brevo" })).toThrow(
      /BREVO_API_KEY/,
    );
    const env = parseEnv(serverEnvSchema, { ...valid, EMAIL_DRIVER: "brevo", BREVO_API_KEY: "k" });
    expect(env.BREVO_API_KEY).toBe("k");
  });

  it("exige CRON_SECRET en producción", () => {
    expect(() => parseEnv(serverEnvSchema, { ...valid, NODE_ENV: "production" })).toThrow(
      /CRON_SECRET/,
    );
  });
});
