"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "@/shared/lib/dates";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/components/tooltip";

/**
 * Fecha relativa ("hace 2 h") con la fecha absoluta en un tooltip (sección 8).
 * El primer render usa el `now` del servidor (sin desajustes de hidratación) y luego
 * se actualiza cada minuto en el navegador.
 */
export function RelativeTime({
  date,
  now,
  className,
}: {
  date: string;
  now: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(() => new Date(now));
  useEffect(() => {
    const id = setInterval(() => setCurrent(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={date} className={className} tabIndex={0}>
          {formatRelative(date, current)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(date)}</TooltipContent>
    </Tooltip>
  );
}
