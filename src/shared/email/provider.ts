import fs from "node:fs/promises";
import path from "node:path";

/** Mensaje de correo ya renderizado. */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Strategy/Adapter: cambiar de proveedor sin tocar la lógica. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Carpeta donde ConsoleEmail deja copia de cada correo (solo desarrollo y pruebas E2E). */
export const DEV_MAILBOX_DIR = path.join(process.cwd(), ".data", "correos");

/**
 * Desarrollo: imprime el correo en consola y guarda una copia JSON por destinatario,
 * para que las pruebas E2E puedan leer el enlace de verificación.
 */
export class ConsoleEmail implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    const links = [...message.text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
    console.info(
      `\n📧 Correo (consola)\n   Para: ${message.to}\n   Asunto: ${message.subject}\n${links
        .map((l) => `   Enlace: ${l}`)
        .join("\n")}\n`,
    );
    try {
      await fs.mkdir(DEV_MAILBOX_DIR, { recursive: true });
      const file = path.join(DEV_MAILBOX_DIR, `${message.to.toLowerCase()}.json`);
      const entry = { ...message, links, sentAt: new Date().toISOString() };
      let history: unknown[] = [];
      try {
        history = JSON.parse(await fs.readFile(file, "utf8")) as unknown[];
      } catch {
        history = [];
      }
      await fs.writeFile(file, JSON.stringify([entry, ...history].slice(0, 20), null, 2));
    } catch {
      // En entornos de solo lectura (serverless) basta con el log.
    }
  }
}

/** Producción: API HTTP de Resend (sin SDK, una dependencia menos). */
export class ResendEmail implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondió ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}

/** Proveedor de pruebas: guarda los correos en memoria. */
export class MemoryEmail implements EmailProvider {
  readonly name = "memory";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
