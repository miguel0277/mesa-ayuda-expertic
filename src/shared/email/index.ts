import "server-only";
import { getEnv } from "@/env";
import { logger } from "@/shared/lib/logger";
import { ConsoleEmail, ResendEmail, type EmailMessage, type EmailProvider } from "./provider";

let provider: EmailProvider | undefined;

/** Proveedor de correo según EMAIL_DRIVER (Strategy). */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const env = getEnv();
  provider =
    env.EMAIL_DRIVER === "resend" && env.RESEND_API_KEY
      ? new ResendEmail(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmail();
  return provider;
}

/**
 * Envío de correos de autenticación (verificación, restablecimiento).
 * No se espera el resultado (evita ataques de tiempo) y un fallo solo se registra.
 */
export function sendAuthEmail(message: EmailMessage): void {
  void getEmailProvider()
    .send(message)
    .catch((err: unknown) =>
      logger.error(
        { err, to: "[redactado]", subject: message.subject },
        "no se pudo enviar el correo de autenticación",
      ),
    );
}
