import { cn } from "@/shared/lib/utils";
import { formatDateTime, formatDue } from "@/shared/lib/dates";
import { SIGNAL_META, type Signal } from "@/shared/ui/status-signal";

/**
 * Regla de tiempo — el elemento distintivo de "Bitácora".
 *
 * Una pista fina que muestra cuánto del plazo ya se consumió, con una marca en el vencimiento.
 * Se usa igual en tickets (SLA), tareas (due_at) y paneles, para que "¿vamos a tiempo?"
 * se lea de la misma forma en toda la app.
 *
 * - Hasta el vencimiento la pista ocupa el 80 % del ancho; el 20 % restante muestra el exceso.
 * - El color sigue al semáforo, y el texto siempre acompaña al color.
 */
export type TimeRailProps = {
  start: Date;
  due: Date;
  now: Date;
  /** Si ya se completó, la regla se congela en ese momento. */
  completedAt?: Date | null;
  signal: Signal;
  className?: string;
  /** Oculta el texto (cuando la fila ya lo muestra en otra columna). */
  compact?: boolean;
};

const DUE_AT = 0.8;

export function railProgress(start: Date, due: Date, at: Date): number {
  const total = Math.max(due.getTime() - start.getTime(), 1);
  const elapsed = at.getTime() - start.getTime();
  const ratio = elapsed / total;
  if (ratio <= 1) return Math.max(0, ratio) * DUE_AT;
  // Exceso: se comprime en el 20 % final (llega al tope al doble del plazo).
  return Math.min(DUE_AT + (ratio - 1) * (1 - DUE_AT), 1);
}

export function TimeRail({
  start,
  due,
  now,
  completedAt,
  signal,
  className,
  compact,
}: TimeRailProps) {
  const at = completedAt ?? now;
  const progress = railProgress(start, due, at);
  const meta = SIGNAL_META[signal];
  const text = completedAt
    ? completedAt <= due
      ? "Cumplida a tiempo"
      : `Cumplida ${formatDue(due, completedAt).replace("Venció hace", "con")} de retraso`
    : formatDue(due, now);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div
        role="meter"
        aria-label="Tiempo consumido del plazo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${meta.label}. ${text}. Vence el ${formatDateTime(due)}`}
        className="relative h-1.5 w-full rounded-full bg-muted"
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", meta.fill)}
          style={{ width: `${progress * 100}%` }}
        />
        {/* Marca del vencimiento */}
        <div
          aria-hidden="true"
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/70"
          style={{ left: `calc(${DUE_AT * 100}% - 1px)` }}
        />
      </div>
      {!compact && (
        <p className={cn("tabular text-xs font-medium", meta.ink)} title={formatDateTime(due)}>
          {text}
        </p>
      )}
    </div>
  );
}
