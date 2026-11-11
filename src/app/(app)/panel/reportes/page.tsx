import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { localParts } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/components/button";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Reportes" };

const pad = (n: number) => String(n).padStart(2, "0");

/** Exportar tickets y tareas a Excel o CSV por rango de fechas (HU-45). */
export default async function ReportesPage() {
  await requireRoute("/panel/reportes");
  const p = localParts(new Date());
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const monthStart = `${p.year}-${pad(p.month)}-01`;
  const field = "h-9 rounded-lg border bg-card px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Descarga las solicitudes y tareas de un periodo para analizarlas o archivarlas."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <form
          action="/api/reportes"
          method="get"
          className="flex flex-col gap-5 rounded-xl border bg-card p-5"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">¿Qué quieres exportar?</legend>
            {[
              {
                v: "tickets",
                l: "Solicitudes (tickets)",
                d: "Código, categoría, solicitante, responsable, fechas y SLA.",
              },
              { v: "tareas", l: "Tareas", d: "Responsable, fecha límite, semáforo y evidencias." },
              { v: "todo", l: "Ambas (solo Excel)", d: "Un libro con una hoja para cada una." },
            ].map((o, i) => (
              <label
                key={o.v}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary/50"
              >
                <input
                  type="radio"
                  name="tipo"
                  value={o.v}
                  defaultChecked={i === 0}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{o.l}</span>
                  <span className="text-xs text-muted-foreground">{o.d}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Desde
              <input
                type="date"
                name="desde"
                defaultValue={monthStart}
                max={today}
                required
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Hasta
              <input
                type="date"
                name="hasta"
                defaultValue={today}
                max={today}
                required
                className={field}
              />
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Formato</legend>
            <div className="flex gap-2">
              {[
                { v: "xlsx", l: "Excel", icon: FileSpreadsheet },
                { v: "csv", l: "CSV", icon: FileText },
              ].map((o, i) => (
                <label
                  key={o.v}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary/50"
                >
                  <input
                    type="radio"
                    name="formato"
                    value={o.v}
                    defaultChecked={i === 0}
                    className="accent-[var(--primary)]"
                  />
                  <o.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {o.l}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="lg" className="self-start">
            <Download data-icon="inline-start" aria-hidden="true" />
            Descargar
          </Button>
        </form>
        <aside className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Las fechas se cuentan en hora de Colombia y se filtran por fecha de creación.</p>
          <p>
            El CSV usa punto y coma como separador para que Excel en español lo abra con columnas y
            tildes correctas.
          </p>
          <p>Cada descarga queda registrada en la auditoría.</p>
        </aside>
      </div>
    </>
  );
}
