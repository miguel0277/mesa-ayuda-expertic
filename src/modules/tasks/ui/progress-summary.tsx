import { Flame } from "lucide-react";
import type { Compliance, Signal } from "../domain/compliance";
import { AnimatedNumber } from "@/shared/ui/animated-number";
import { StatusSignal } from "@/shared/ui/status-signal";
import { cn } from "@/shared/lib/utils";

/**
 * "Mi progreso" (HU-22): % de cumplimiento del mes, completadas vs. pendientes y racha.
 * Una sola banda, como los KPIs del panel.
 */
export function ProgressSummary({
  month,
  streak,
  signal,
}: {
  month: Compliance;
  streak: number;
  signal: Signal | null;
}) {
  const pct = month.pct;
  return (
    <section
      aria-label="Tu progreso del mes"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4"
    >
      <div className="col-span-2 flex flex-col gap-2 bg-card p-4 lg:col-span-1">
        <p className="text-sm text-muted-foreground">Cumplimiento del mes</p>
        <p className="tabular text-[1.75rem] leading-none font-semibold tracking-tight">
          {pct === null ? (
            "—"
          ) : (
            <AnimatedNumber value={pct} decimals={pct % 1 ? 1 : 0} suffix=" %" />
          )}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn(
              "progress-grow h-full rounded-full",
              pct === null
                ? ""
                : pct >= 85
                  ? "bg-ok-fill"
                  : pct >= 60
                    ? "bg-risk-fill"
                    : "bg-late-fill",
            )}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
        <p className="tabular text-xs text-muted-foreground">
          {pct === null
            ? "Aún no vence ninguna tarea este mes."
            : `${month.onTime} de ${month.dueElapsed} a tiempo`}
        </p>
      </div>
      <div className="flex flex-col gap-1 bg-card p-4">
        <p className="text-sm text-muted-foreground">Completadas</p>
        <p className="tabular text-[1.75rem] leading-none font-semibold tracking-tight">
          <AnimatedNumber value={month.completed} />
        </p>
        <p className="text-xs text-muted-foreground">
          {month.completedLate ? `${month.completedLate} tarde` : "este mes"}
        </p>
      </div>
      <div className="flex flex-col gap-1 bg-card p-4">
        <p className="text-sm text-muted-foreground">Pendientes</p>
        <p
          className={cn(
            "tabular text-[1.75rem] leading-none font-semibold tracking-tight",
            month.overdue > 0 && "text-late",
          )}
        >
          <AnimatedNumber value={month.open} />
        </p>
        <p className="text-xs text-muted-foreground">
          {month.overdue
            ? `${month.overdue} atrasada(s)`
            : month.atRisk
              ? `${month.atRisk} en riesgo`
              : "al día"}
        </p>
      </div>
      <div className="col-span-2 flex flex-col gap-1 bg-card p-4 lg:col-span-1">
        <p className="text-sm text-muted-foreground">Racha a tiempo</p>
        <p className="flex items-center gap-2 text-[1.75rem] leading-none font-semibold tracking-tight">
          <Flame
            aria-hidden="true"
            className={cn("size-6", streak > 0 ? "text-risk-fill" : "text-muted-foreground/40")}
          />
          <span className="tabular">
            <AnimatedNumber value={streak} />
          </span>
        </p>
        <div className="mt-auto">
          {signal ? (
            <StatusSignal
              signal={signal}
              label={`Hoy: ${signal === "a_tiempo" ? "a tiempo" : signal === "en_riesgo" ? "en riesgo" : "atrasada"}`}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Sin tareas abiertas con fecha</span>
          )}
        </div>
      </div>
    </section>
  );
}
