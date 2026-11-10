"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";

/**
 * Centro de notificaciones (HU-60). Fase 2: vacío.
 * En la Fase 4 recibe la lista real, el contador animado y "marcar como leídas" optimista.
 */
export function NotificationBell({ unread = 0 }: { unread?: number }) {
  const label = unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span className="tabular absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-late-fill px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          <Link href="/notificaciones" className="text-sm font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>
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
      </PopoverContent>
    </Popover>
  );
}
