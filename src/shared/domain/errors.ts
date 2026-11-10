/**
 * Errores de dominio. Son valores (se devuelven dentro de Result), no excepciones.
 * `message` es apto para mostrar al usuario final (español, sin jerga).
 */
export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "UNEXPECTED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }

  /** Forma serializable para enviar a la UI. */
  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export const validationError = (message: string, fieldErrors?: Record<string, string[]>) =>
  new DomainError("VALIDATION", message, fieldErrors ? { fieldErrors } : undefined);

export const notFound = (entity: string) =>
  new DomainError("NOT_FOUND", `No encontramos ${entity}.`, { entity });

export const forbidden = (message = "No tienes permiso para realizar esta acción.") =>
  new DomainError("FORBIDDEN", message);

export const unauthenticated = () =>
  new DomainError("UNAUTHENTICATED", "Tu sesión terminó. Inicia sesión de nuevo.");

export const conflict = (message: string) => new DomainError("CONFLICT", message);

export const invalidTransition = (entity: string, from: string, to: string) =>
  new DomainError("INVALID_TRANSITION", `No se puede pasar de "${from}" a "${to}".`, {
    entity,
    from,
    to,
  });

export const unexpected = (message = "Ocurrió un error inesperado. Intenta de nuevo.") =>
  new DomainError("UNEXPECTED", message);
