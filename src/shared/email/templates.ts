import type { EmailMessage } from "./provider";

/**
 * Plantillas de correo en español. HTML sencillo con estilos en línea (los clientes de correo
 * ignoran CSS externo) y versión de texto plano siempre.
 */

const BRAND = "#1673BB";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

function layout(opts: {
  title: string;
  intro: string;
  cta?: { label: string; url: string };
  outro?: string;
}) {
  const button = opts.cta
    ? `<p style="margin:28px 0"><a href="${escape(opts.cta.url)}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escape(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#16202b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #d9e1e9;border-radius:12px"><tr><td style="padding:28px 32px">
<p style="margin:0 0 20px;font-size:14px;color:#556373"><strong style="color:${BRAND}">Exper</strong><strong>TIC</strong> · Mesa de Ayuda</p>
<h1 style="margin:0 0 12px;font-size:20px">${escape(opts.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6">${opts.intro}</p>
${button}
${opts.outro ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#556373">${opts.outro}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#556373;margin:16px 0 0">Este es un mensaje automático de la Mesa de Ayuda ExperTIC (UIS). No respondas a este correo.</p>
</td></tr></table></body></html>`;
}

function message(to: string, subject: string, html: string, text: string): EmailMessage {
  return { to, subject, html, text };
}

export const emails = {
  verifyEmail(to: string, name: string, url: string) {
    return message(
      to,
      "Confirma tu correo · Mesa de Ayuda ExperTIC",
      layout({
        title: `Hola, ${name}`,
        intro: "Confirma tu correo para activar tu cuenta en la Mesa de Ayuda ExperTIC.",
        cta: { label: "Confirmar mi correo", url },
        outro: "El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.",
      }),
      `Hola, ${name}.\n\nConfirma tu correo para activar tu cuenta en la Mesa de Ayuda ExperTIC:\n${url}\n\nEl enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.`,
    );
  },

  resetPassword(to: string, name: string, url: string) {
    return message(
      to,
      "Restablece tu contraseña · Mesa de Ayuda ExperTIC",
      layout({
        title: "Restablece tu contraseña",
        intro: `Hola, ${escape(name)}. Recibimos una solicitud para cambiar tu contraseña.`,
        cta: { label: "Elegir una contraseña nueva", url },
        outro:
          "El enlace vence en 1 hora. Si no fuiste tú, ignora este correo: tu contraseña no cambia.",
      }),
      `Hola, ${name}.\n\nPara elegir una contraseña nueva entra a:\n${url}\n\nEl enlace vence en 1 hora. Si no fuiste tú, ignora este correo.`,
    );
  },

  accountApproved(to: string, name: string, roleLabel: string, url: string) {
    return message(
      to,
      "Tu cuenta fue aprobada · Mesa de Ayuda ExperTIC",
      layout({
        title: "Ya puedes entrar",
        intro: `Hola, ${escape(name)}. Tu cuenta como <strong>${escape(roleLabel)}</strong> fue aprobada.`,
        cta: { label: "Iniciar sesión", url },
      }),
      `Hola, ${name}. Tu cuenta como ${roleLabel} fue aprobada. Inicia sesión en ${url}`,
    );
  },

  /** Aviso genérico de un evento (ticket o tarea) con enlace directo. */
  notice(
    to: string,
    subject: string,
    title: string,
    body: string,
    url: string,
    cta = "Ver en la Mesa de Ayuda",
  ) {
    return message(
      to,
      `${subject} · Mesa de Ayuda ExperTIC`,
      layout({ title, intro: escape(body), cta: { label: cta, url } }),
      `${title}\n\n${body}\n\n${url}`,
    );
  },
};
