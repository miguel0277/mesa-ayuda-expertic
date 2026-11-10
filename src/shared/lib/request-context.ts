import "server-only";
import { headers } from "next/headers";
import { REQUEST_ID_HEADER } from "./request-id";

export type RequestContext = {
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
};

/** Datos de la petición actual para logs y auditoría (Server Components, acciones y rutas). */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    requestId: h.get(REQUEST_ID_HEADER),
    ip: forwarded?.split(",")[0]?.trim() || h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}
