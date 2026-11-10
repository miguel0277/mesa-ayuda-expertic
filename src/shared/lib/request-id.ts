/** Cabecera donde viaja el identificador de petición (proxy → logs → auditoría → errores). */
export const REQUEST_ID_HEADER = "x-request-id";

const VALID = /^[A-Za-z0-9._-]{8,128}$/;

/** Reutiliza un id entrante válido (p. ej. de Vercel) o genera uno nuevo. */
export function resolveRequestId(incoming: string | null | undefined): string {
  if (incoming && VALID.test(incoming)) return incoming;
  return crypto.randomUUID();
}
