import pino, { type Logger } from "pino";

/**
 * Logs estructurados en JSON. Nunca se registran contraseñas, tokens, cookies
 * ni contenido de adjuntos (se redactan aunque lleguen por error).
 */
export const REDACT_PATHS = [
  "password",
  "*.password",
  "newPassword",
  "*.newPassword",
  "currentPassword",
  "*.currentPassword",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "secret",
  "*.secret",
  "headers.authorization",
  "headers.cookie",
  "*.headers.authorization",
  "*.headers.cookie",
  "content",
  "*.content",
  "buffer",
  "*.buffer",
];

export function createLogger(level: string = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({
    level,
    base: { app: "mesa-ayuda-expertic", env: process.env.VERCEL_ENV ?? process.env.NODE_ENV },
    redact: { paths: REDACT_PATHS, censor: "[redactado]" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
  });
}

const globalForLogger = globalThis as unknown as { __expertic_logger?: Logger };

export const logger: Logger = (globalForLogger.__expertic_logger ??= createLogger());

/** Logger hijo con el requestId de la petición en curso. */
export const withRequest = (
  requestId: string | null | undefined,
  bindings: Record<string, unknown> = {},
) => logger.child({ requestId: requestId ?? undefined, ...bindings });
