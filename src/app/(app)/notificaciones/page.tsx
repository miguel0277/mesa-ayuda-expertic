import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  listNotifications,
  unreadCount,
} from "@/modules/notifications/infrastructure/notification-queries";
import { MarkAllButton } from "@/modules/notifications/ui/mark-all-button";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { formatDateTime, formatRelative } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import { EmptyState, PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage({ searchParams }: PageProps<"/notificaciones">) {
  const viewer = await requireRoute("/notificaciones");
  const sp = await searchParams;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;
  const onlyUnread = sp.ver === "sin-leer";
  const db = getDb();
  const [list, unread] = await Promise.all([
    listNotifications(db, viewer.id, { cursor, limit: 30, unreadOnly: onlyUnread }),
    unreadCount(db, viewer.id),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description={unread ? `Tienes ${unread} sin leer.` : "Estás al día."}
        actions={unread > 0 ? <MarkAllButton /> : undefined}
      />
      <nav aria-label="Filtro" className="mb-4 flex gap-1 border-b">
        {[
          { key: false, label: "Todas", href: "/notificaciones" },
          { key: true, label: `Sin leer (${unread})`, href: "/notificaciones?ver=sin-leer" },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={onlyUnread === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
              onlyUnread === t.key && "border-primary font-medium text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title={onlyUnread ? "No tienes notificaciones sin leer" : "Aún no tienes notificaciones"}
          description="Aquí verás cuando te asignen algo, respondan tus solicitudes o una tarea esté por vencer."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href ?? "#"}
                className={cn(
                  "flex gap-3 px-4 py-3 hover:bg-accent",
                  !n.readAt && "bg-secondary/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-2 size-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-sm", !n.readAt && "font-medium")}>
                    {n.title}
                    {!n.readAt && <span className="sr-only"> (sin leer)</span>}
                  </span>
                  {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
                </span>
                <time
                  dateTime={n.createdAt}
                  title={formatDateTime(n.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatRelative(n.createdAt, now)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.nextCursor && (
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/notificaciones?${new URLSearchParams({ ...(onlyUnread ? { ver: "sin-leer" } : {}), cursor: list.nextCursor })}`}
            >
              Ver anteriores
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
