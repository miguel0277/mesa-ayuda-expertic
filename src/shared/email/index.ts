import "server-only";
import { after } from "next/server";
import { getEnv } from "@/env";
import { logger } from "@/shared/lib/logger";
import {
  BrevoEmail,
  ConsoleEmail,
  ResendEmail,
  type EmailMessage,
  type EmailProvider,
} from "./provider";

let provider: EmailProvider | undefined;

/** Proveedor de correo según EMAIL_DRIVER (Strategy). */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const env = getEnv();
  if (env.EMAIL_DRIVER === "brevo" && env.BREVO_API_KEY) {
    provider = new BrevoEmail(env.BREVO_API_KEY, env.EMAIL_FROM);
  } else if (env.EMAIL_DRIVER === "resend" && env.RESEND_API_KEY) {
    provider = new ResendEmail(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    provider = new ConsoleEmail();
  }
  return provider;
}

/**
 * Envío de correos de autenticación (verificación, restablecimiento).
 * Se responde sin esperar el envío (evita ataques de tiempo), pero con `after()` para que
 * Vercel no congele la función antes de terminarlo. Un fallo solo se registra.
 */
export function sendAuthEmail(message: EmailMessage): void {
  const task = () =>
    getEmailProvider()
      .send(message)
      .catch((err: unknown) =>
        logger.error(
          { err, to: "[redactado]", subject: message.subject },
          "no se pudo enviar el correo de autenticación",
        ),
      );
  try {
    after(task);
  } catch {
    // Fuera de una petición (scripts, pruebas): enviar sin esperar.
    void task();
  }
}
