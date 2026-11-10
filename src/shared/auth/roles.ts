/**
 * Roles de la app. Fuente única: el esquema de BD (enum `user_role`) los importa de aquí.
 * Sin dependencias, para poder usarse también en componentes de cliente.
 */
export const ROLES = ["admin", "docente", "lider", "auxiliar", "profesor", "estudiante"] as const;
export type Role = (typeof ROLES)[number];

/** Nombre visible de cada rol (español, sin jerga). */
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  docente: "Docente ExperTIC",
  lider: "Auxiliar líder",
  auxiliar: "Auxiliar",
  profesor: "Profesor",
  estudiante: "Estudiante",
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);
