import { CircleAlert, CircleCheck, Clock3, type LucideIcon } from "lucide-react";
import { Badge } from "@/shared/ui/components/badge";

/**
 * Señal del semáforo de cumplimiento (sección 5.5).
 * Accesible: color + ícono + texto, nunca solo color.
 */
export type Signal = "a_tiempo" | "en_riesgo" | "atrasada";

export const SIGNAL_META: Record<
  Signal,
  { label: string; icon: LucideIcon; variant: "ok" | "risk" | "late"; fill: string; ink: string }
> = {
  a_tiempo: {
    label: "A tiempo",
    icon: CircleCheck,
    variant: "ok",
    fill: "bg-ok-fill",
    ink: "text-ok",
  },
  en_riesgo: {
    label: "En riesgo",
    icon: Clock3,
    variant: "risk",
    fill: "bg-risk-fill",
    ink: "text-risk",
  },
  atrasada: {
    label: "Atrasada",
    icon: CircleAlert,
    variant: "late",
    fill: "bg-late-fill",
    ink: "text-late",
  },
};

export function StatusSignal({ signal, label }: { signal: Signal; label?: string }) {
  const meta = SIGNAL_META[signal];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="h-6 gap-1.5 px-2 text-xs">
      <Icon aria-hidden="true" data-icon="inline-start" />
      {label ?? meta.label}
    </Badge>
  );
}
