"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor } from "@/shared/ui/shell/nav";
import { isRole } from "./roles";
import { DEV_ROLE_COOKIE, devViewerEnabled } from "./viewer";

/**
 * Solo desarrollo (Fase 2): cambia el rol del visitante de prueba.
 * En producción no hace nada. La Fase 3 lo reemplaza por "Ver como" (impersonation) del admin.
 */
export async function switchDevRole(role: string): Promise<void> {
  if (!devViewerEnabled() || !isRole(role)) return;
  const store = await cookies();
  store.set(DEV_ROLE_COOKIE, role, { path: "/", sameSite: "lax", httpOnly: true });
  redirect(homeFor(role));
}
