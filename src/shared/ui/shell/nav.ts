import {
  Activity,
  Bell,
  ChartColumn,
  ClipboardList,
  FilePlus2,
  FileSliders,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  type LucideIcon,
  MessagesSquare,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import type { Role } from "@/shared/auth/roles";

/**
 * Mapa de navegación por rol (sección 7 del prompt).
 * Fase 3: el acceso real lo decide `can()` en el servidor; este mapa solo arma el menú
 * y sirve de guardia provisional (`canVisit`).
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Palabras extra para la paleta ⌘K. */
  keywords?: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

const STAFF: Role[] = ["auxiliar", "lider"];
const EVERYONE: Role[] = ["admin", "docente", "lider", "auxiliar", "profesor", "estudiante"];

export const NAV: NavGroup[] = [
  {
    label: "Seguimiento",
    items: [
      {
        href: "/panel",
        label: "Panel de control",
        icon: LayoutDashboard,
        roles: ["docente", "admin"],
        keywords: ["kpi", "indicadores", "inicio"],
      },
      {
        href: "/panel/tickets",
        label: "Bandeja de tickets",
        icon: Inbox,
        roles: ["docente", "admin"],
        keywords: ["solicitudes", "asignar"],
      },
      {
        href: "/panel/tareas",
        label: "Tareas del equipo",
        icon: ClipboardList,
        roles: ["docente", "admin"],
        keywords: ["asignar", "auxiliares"],
      },
      {
        href: "/equipo",
        label: "Mi equipo",
        icon: UsersRound,
        roles: ["lider"],
        keywords: ["auxiliares", "avance"],
      },
      {
        href: "/tareas",
        label: "Mis tareas",
        icon: ListTodo,
        roles: STAFF,
        keywords: ["kanban", "pendientes", "evidencia"],
      },
      {
        href: "/tickets-asignados",
        label: "Tickets asignados",
        icon: MessagesSquare,
        roles: STAFF,
        keywords: ["responder", "soporte"],
      },
    ],
  },
  {
    label: "Solicitudes",
    items: [
      {
        href: "/solicitudes",
        label: "Mis solicitudes",
        icon: Inbox,
        roles: ["profesor", "estudiante", "auxiliar", "lider"],
        keywords: ["tickets", "estado"],
      },
      {
        href: "/solicitudes/nueva",
        label: "Nueva solicitud",
        icon: FilePlus2,
        roles: EVERYONE,
        keywords: ["crear", "ticket", "reportar", "soporte"],
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        href: "/panel/auxiliares",
        label: "Auxiliares y equipos",
        icon: Users,
        roles: ["docente", "admin"],
        keywords: ["semestre", "aprobar", "roles"],
      },
      {
        href: "/panel/plantillas",
        label: "Plantillas y SLA",
        icon: FileSliders,
        roles: ["docente", "admin"],
        keywords: ["categorías", "campos", "tiempos"],
      },
      {
        href: "/panel/reportes",
        label: "Reportes",
        icon: ChartColumn,
        roles: ["docente", "admin"],
        keywords: ["exportar", "excel", "csv"],
      },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/admin", label: "Consola", icon: ShieldCheck, roles: ["admin"] },
      {
        href: "/admin/usuarios",
        label: "Usuarios",
        icon: UserRound,
        roles: ["admin"],
        keywords: ["bloquear", "rol", "ver como"],
      },
      { href: "/admin/equipos", label: "Equipos", icon: UsersRound, roles: ["admin"] },
      {
        href: "/admin/auditoria",
        label: "Auditoría",
        icon: History,
        roles: ["admin"],
        keywords: ["historial", "cambios", "registro"],
      },
      { href: "/admin/ajustes", label: "Ajustes", icon: Settings, roles: ["admin"] },
      {
        href: "/admin/sistema",
        label: "Salud del sistema",
        icon: Activity,
        roles: ["admin"],
        keywords: ["base de datos", "errores", "versión"],
      },
    ],
  },
];

/** Rutas de cuenta: disponibles para todos, en el menú de usuario. */
export const ACCOUNT_NAV: NavItem[] = [
  {
    href: "/perfil",
    label: "Mi perfil",
    icon: UserRound,
    roles: EVERYONE,
    keywords: ["contraseña", "foto", "teléfono"],
  },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell, roles: EVERYONE },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Página de inicio de cada rol (destino de /inicio). */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
    case "docente":
      return "/panel";
    case "lider":
      return "/equipo";
    case "auxiliar":
      return "/tareas";
    default:
      return "/solicitudes";
  }
}

const ALL_ITEMS = [...NAV.flatMap((g) => g.items), ...ACCOUNT_NAV];

/** Guardia provisional (Fase 2): ¿el rol puede ver esta ruta? */
export function canVisit(role: Role, href: string): boolean {
  const item = ALL_ITEMS.find((i) => i.href === href);
  return item ? item.roles.includes(role) : false;
}

/** Etiquetas para migas de pan. */
export function labelFor(href: string): string | undefined {
  return ALL_ITEMS.find((i) => i.href === href)?.label;
}

/** El ítem activo es el de prefijo más largo que coincide con la ruta. */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Guardia por prefijo para el proxy: busca el ítem de menú más específico que contiene la ruta.
 * Si la ruta no pertenece a ningún ítem (p. ej. /inicio), la decide la página.
 */
export function canVisitPath(role: Role, pathname: string): boolean {
  const match = ALL_ITEMS.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return true;
  // /solicitudes/[código]: cualquiera puede abrir el detalle; la página verifica si es suyo.
  if (match.href === "/solicitudes" && pathname !== "/solicitudes") return true;
  // /tareas/[código]: también la abren quien la asignó (docente, admin); la página verifica el acceso.
  if (match.href === "/tareas" && pathname !== "/tareas")
    return role !== "profesor" && role !== "estudiante";
  return match.roles.includes(role);
}
