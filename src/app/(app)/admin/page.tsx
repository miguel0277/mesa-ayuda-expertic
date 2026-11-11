import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  Activity,
  ChartColumn,
  ClipboardList,
  FileSliders,
  History,
  Inbox,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { auditLog, tasks, tickets, user } from "@/shared/db/schema";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Consola" };

/** Consola del administrador (HU-50): acceso a todo, con lo que requiere atención primero. */
export default async function AdminPage() {
  await requireRoute("/admin");
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - 86_400_000);
  const [[users], [pending], [openTickets], [openTasks], [events]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(user),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.status, "pendiente")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        inArray(tickets.status, ["abierto", "asignado", "en_progreso", "respondido", "reabierto"]),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(inArray(tasks.status, ["pendiente", "en_progreso"])),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(and(gte(auditLog.occurredAt, since))),
  ]);

  const sections: {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    stat?: string;
    alert?: boolean;
  }[] = [
    {
      href: "/admin/usuarios",
      title: "Usuarios",
      description:
        "Crear, aprobar, cambiar rol, bloquear, restablecer acceso y ver como otra persona.",
      icon: UserRound,
      stat: pending?.n ? `${pending.n} por aprobar` : `${users?.n ?? 0} cuentas`,
      alert: !!pending?.n,
    },
    {
      href: "/admin/equipos",
      title: "Equipos",
      description: "Equipos de cada semestre y su historial.",
      icon: UsersRound,
    },
    {
      href: "/panel/tickets",
      title: "Tickets",
      description: "Bandeja global con filtros y acciones en lote.",
      icon: Inbox,
      stat: `${openTickets?.n ?? 0} abiertos`,
    },
    {
      href: "/panel/tareas",
      title: "Tareas",
      description: "Tareas de todos los auxiliares y su cumplimiento.",
      icon: ClipboardList,
      stat: `${openTasks?.n ?? 0} abiertas`,
    },
    {
      href: "/panel/plantillas",
      title: "Plantillas y SLA",
      description: "Categorías de solicitud, sus campos y los tiempos de atención.",
      icon: FileSliders,
    },
    {
      href: "/panel/reportes",
      title: "Reportes",
      description: "Exportar tickets y tareas a Excel o CSV.",
      icon: ChartColumn,
    },
    {
      href: "/admin/auditoria",
      title: "Auditoría",
      description: "Quién cambió qué y cuándo, con el antes y el después.",
      icon: History,
      stat: `${events?.n ?? 0} eventos en 24 h`,
    },
    {
      href: "/admin/ajustes",
      title: "Ajustes",
      description: "Dominios de correo, aprobaciones, adjuntos, umbral de riesgo y autocierre.",
      icon: Settings,
    },
    {
      href: "/admin/sistema",
      title: "Salud del sistema",
      description: "Base de datos, correo, tareas programadas y errores recientes.",
      icon: Activity,
    },
  ];

  return (
    <>
      <PageHeader
        title="Consola de administración"
        description="Todo lo que gestiona el administrador, en un solo lugar."
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <s.icon aria-hidden="true" className="size-4" />
                </span>
                <span className="font-medium">{s.title}</span>
                {s.stat && (
                  <span
                    className={`tabular ml-auto rounded-full px-2 py-0.5 text-xs ${s.alert ? "bg-risk-soft font-medium text-risk" : "bg-muted text-muted-foreground"}`}
                  >
                    {s.stat}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
