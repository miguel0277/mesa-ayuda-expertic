import { z } from "zod";

/**
 * Validación de variables de entorno al arrancar.
 * Si falta una obligatoria, la app falla con un mensaje claro en español.
 * `SKIP_ENV_VALIDATION=1` solo para CI/lint donde no hay secretos.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const csvList = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],
  z.array(z.string()),
);

const postgresUrl = (name: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string({ error: `Falta ${name}. Revisa docs/BASE_DE_DATOS.md.` })
      .refine((v) => /^postgres(ql)?:\/\//.test(v), `${name} debe empezar por postgresql://`),
  );

/** Variables mínimas para scripts de base de datos (migrar, semilla). */
export const dbEnvSchema = z.object({
  DATABASE_URL_UNPOOLED: postgresUrl("DATABASE_URL_UNPOOLED"),
});

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrl("DATABASE_URL"),
    DATABASE_URL_UNPOOLED: postgresUrl("DATABASE_URL_UNPOOLED"),
    BETTER_AUTH_SECRET: z
      .string({ error: "Falta BETTER_AUTH_SECRET (genera uno con: openssl rand -base64 32)." })
      .min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres."),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL debe ser una URL válida."),
    NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL debe ser una URL válida."),
    ALLOWED_EMAIL_DOMAINS: csvList,
    SEED_ADMIN_EMAIL: optionalString,
    SEED_ADMIN_PASSWORD: optionalString,
    STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).default("local"),
    BLOB_READ_WRITE_TOKEN: optionalString,
    EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default("Mesa de Ayuda ExperTIC <no-responder@localhost>"),
    CRON_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(16, "CRON_SECRET debe tener al menos 16 caracteres.").optional(),
    ),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "vercel-blob" && !env.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["BLOB_READ_WRITE_TOKEN"],
        message: "Falta BLOB_READ_WRITE_TOKEN (requerido con STORAGE_DRIVER=vercel-blob).",
      });
    }
    if (env.EMAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Falta RESEND_API_KEY (requerido con EMAIL_DRIVER=resend).",
      });
    }
    if (env.NODE_ENV === "production" && !env.CRON_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "Falta CRON_SECRET (obligatorio en producción).",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map((i) => `  • ${i.path.join(".") || "(raíz)"}: ${i.message}`);
  return `\n❌ Variables de entorno inválidas o faltantes:\n${lines.join("\n")}\n\nCopia .env.example a .env.local y complétalo.\n`;
}

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Acceso perezoso y validado al entorno del servidor. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    // Valores de relleno solo para lo que esté vacío (CI sin secretos).
    const provided = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""),
    );
    cached = parseEnv(serverEnvSchema, {
      DATABASE_URL: "postgresql://skip@localhost/skip",
      DATABASE_URL_UNPOOLED: "postgresql://skip@localhost/skip",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ...provided,
    });
    return cached;
  }
  cached = parseEnv(serverEnvSchema);
  return cached;
}
