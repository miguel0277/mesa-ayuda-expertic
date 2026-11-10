import "server-only";
import type { z } from "zod";
import type { RequestMeta } from "@/modules/audit/domain/audit-entry";
import { getViewer, type Viewer } from "@/shared/auth/viewer";
import { DomainError } from "@/shared/domain/errors";
import type { Result } from "@/shared/domain/result";
import type { UseCaseContext } from "@/shared/kernel/app-event";
import { getContainer, type Container } from "@/shared/kernel/container";
import { logger } from "./logger";
import { getRequestContext } from "./request-context";

/** Resultado serializable de una Server Action (lo consume la UI). */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
        requestId?: string | null;
      };
    };

export type ActionContext = {
  viewer: Viewer;
  meta: RequestMeta;
  c: Container;
  /** Contexto listo para los casos de uso. */
  uc: UseCaseContext;
};

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Envoltorio de Server Actions:
 * - exige sesión activa,
 * - valida la entrada con Zod (misma regla que en el cliente),
 * - traduce errores de dominio a mensajes y registra los inesperados con el requestId.
 */
export function defineAction<S extends z.ZodType, O>(
  schema: S,
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<Result<O, DomainError>>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<O>> => {
    const meta = await getRequestContext();
    try {
      const viewer = await getViewer();
      if (!viewer)
        return {
          ok: false,
          error: { code: "UNAUTHENTICATED", message: "Tu sesión terminó. Inicia sesión de nuevo." },
        };
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Revisa los campos marcados.",
            fieldErrors: fieldErrorsOf(parsed.error),
          },
        };
      }
      const c = getContainer();
      const uc: UseCaseContext = { actor: viewer, meta, now: c.clock.now() };
      const result = await handler(parsed.data, { viewer, meta, c, uc });
      if (result.ok) return { ok: true, data: result.value };
      const e = result.error;
      return {
        ok: false,
        error: {
          code: e.code,
          message: e.message,
          fieldErrors: e.details?.fieldErrors as Record<string, string[]> | undefined,
        },
      };
    } catch (err) {
      if (err instanceof DomainError)
        return { ok: false, error: { code: err.code, message: err.message } };
      logger.error({ err, requestId: meta.requestId }, "acción falló");
      return {
        ok: false,
        error: {
          code: "UNEXPECTED",
          message:
            "Ocurrió un error inesperado. Intenta de nuevo; si sigue pasando, avísale al administrador.",
          requestId: meta.requestId,
        },
      };
    }
  };
}
