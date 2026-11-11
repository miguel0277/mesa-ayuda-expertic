"use client";

import { Bell, BellRing, CheckCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { latestNotificationsAction, markReadAction } from "@/modules/notifications/ui/actions";
import type { NotificationDTO } from "@/modules/notifications/infrastructure/notification-queries";
import { formatDateTime, formatRelative } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { Spinner } from "@/shared/ui/components/spinner";
import { pulseOnce } from "@/shared/ui/motion";

/**
 * Centro de notificaciones (HU-60): contador, últimas al abrir y "marcar como leídas" optimista.
 * El contador pulsa una vez cuando llega algo nuevo (se revisa cada 60 s y al volver a la pestaña).
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [optimisticItems, markLocal] = useOptimistic(
    items,
    (state, ids: string[] | null) =>
      state?.map((n) =>
        !ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
      ) ?? null,
  );
  const [loading, startLoad] = useTransition();
  const [, startMark] = useTransition();
  const [pulse, setPulse] = useState(0);
  const prev = useRef(initialUnread);

  const refresh = () =>
    startLoad(async () => {
      const r = await latestNotificationsAction({});
      if (!r.ok) return;
      setItems(r.data.items);
      setUnread(r.data.unread);
    });

  // Revisión periódica liviana (sin tiempo real: fuera del alcance de la iteración).
  useEffect(() => {
    const check = async () => {
      const r = await latestNotificationsAction({});
      if (r.ok) setUnread(r.data.unread);
    };
    const id = setInterval(check, 60_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (unread > prev.current) setPulse((p) => p + 1);
    prev.current = unread;
  }, [unread]);

  const mark = (ids: string[] | null) =>
    startMark(async () => {
      markLocal(ids);
      const before = unread;
      setUnread(ids ? Math.max(0, unread - ids.length) : 0);
      const r = await markReadAction({ ids });
      if (!r.ok) {
        setUnread(before);
        toast.error("No pudimos marcarlas como leídas.");
        return;
      }
      setUnread(r.data.unread);
      setItems(
        (s) =>
          s?.map((n) =>
            !ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
          ) ?? null,
      );
      router.refresh();
    });

  const now = new Date();
  const label = unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones";
  return (
    <Popover onOpenChange={(o) => o && refresh()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <motion.span
              key={pulse}
              variants={pulseOnce}
              initial="initial"
              animate="pulse"
              className="tabular absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-late-fill px-1 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => mark(null)}>
              <CheckCheck data-icon="inline-start" aria-hidden="true" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
        {optimisticItems === null || (loading && !optimisticItems.length) ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-muted-foreground" />
          </div>
        ) : optimisticItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok">
              <BellRing aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-medium">Estás al día</p>
            <p className="text-sm text-muted-foreground">
              Aquí verás cuando te asignen algo, respondan tus solicitudes o una tarea esté por
              vencer.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {optimisticItems.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "/notificaciones"}
                  onClick={() => !n.readAt && mark([n.id])}
                  className={cn(
                    "flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent",
                    !n.readAt && "bg-secondary/40",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("truncate", !n.readAt && "font-medium")}>{n.title}</span>
                    {n.body && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <time
                      dateTime={n.createdAt}
                      title={formatDateTime(n.createdAt)}
                      className="text-xs text-muted-foreground"
                    >
                      {formatRelative(n.createdAt, now)}
                    </time>
                  </span>
                  {!n.readAt && <span className="sr-only">(sin leer)</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-4 py-2.5 text-center">
          <Link href="/notificaciones" className="text-sm font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
