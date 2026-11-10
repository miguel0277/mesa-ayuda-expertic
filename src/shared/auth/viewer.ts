import "server-only";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { canVisit } from "@/shared/ui/shell/nav";
import { isRole, ROLE_LABEL, type Role } from "./roles";

/**
 * Quién está viendo la app.
 *
 * ⚠ FASE 2 (provisional): mientras no hay autenticación, en DESARROLLO el rol se elige con la
 * cookie `dev_rol` (selector "Ver como" del menú de usuario). En PRODUCCIÓN no hay visitante
 * y se redirige a /login. La Fase 3 reemplaza esta función por la sesión de Better Auth.
 */
export type Viewer = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  image: string | null;
  /** true solo con el visitante de desarrollo (muestra el selector de rol). */
  isDevViewer: boolean;
};

export const DEV_ROLE_COOKIE = "dev_rol";

const DEV_NAMES: Record<Role, { name: string; email: string }> = {
  admin: { name: "Administrador ExperTIC", email: "admin@expertic.test" },
  docente: { name: "Carolina Méndez Rueda", email: "docente@expertic.test" },
  lider: { name: "Andrés Felipe Gómez Pardo", email: "lider1@expertic.test" },
  auxiliar: { name: "Juan Sebastián Ortiz Peña", email: "aux1@expertic.test" },
  profesor: { name: "Jorge Eliécer Rangel Torres", email: "profesor1@expertic.test" },
  estudiante: { name: "Natalia Sofía Duarte Gil", email: "estudiante1@expertic.test" },
};

export const devViewerEnabled = () => process.env.NODE_ENV !== "production";

export async function getViewer(): Promise<Viewer | null> {
  if (!devViewerEnabled()) return null;
  const store = await cookies();
  const raw = store.get(DEV_ROLE_COOKIE)?.value;
  const role: Role = isRole(raw) ? raw : "docente";
  return {
    id: `dev-${role}`,
    ...DEV_NAMES[role],
    role,
    roleLabel: ROLE_LABEL[role],
    image: null,
    isDevViewer: true,
  };
}

/** Exige un visitante; si no hay, va al inicio de sesión. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Exige visitante y acceso a la ruta; si no lo tiene, responde 403 con la página amable. */
export async function requireRoute(href: string): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!canVisit(viewer.role, href)) forbidden();
  return viewer;
}
