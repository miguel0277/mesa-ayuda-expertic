"use client";

import { Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Priority } from "@/shared/db/schema/enums";
import { colombianHolidays } from "@/shared/lib/holidays-co";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { saveSlaAction } from "./actions";

type Policy = { priority: Priority; firstResponseMinutes: number; resolutionMinutes: number };
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const LABEL: Record<Priority, string> = { alta: "Alta", media: "Media", baja: "Baja" };

/** Configuración de SLA (HU-44): tiempos por prioridad en horas hábiles, horario y festivos. */
export function SlaEditor({
  policies,
  start: s0,
  end: e0,
  days: d0,
  extraHolidays,
}: {
  policies: Policy[];
  start: string;
  end: string;
  days: number[];
  extraHolidays: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(policies);
  const [start, setStart] = useState(s0);
  const [end, setEnd] = useState(e0);
  const [days, setDays] = useState(d0);
  const [extra, setExtra] = useState(extraHolidays);
  const [newDate, setNewDate] = useState("");
  const [pending, run] = useTransition();
  const year = new Date().getFullYear();
  const legal = colombianHolidays(year);

  const setHours = (p: Priority, k: "firstResponseMinutes" | "resolutionMinutes", h: string) =>
    setRows((r) =>
      r.map((x) => (x.priority === p ? { ...x, [k]: Math.round(Number(h || 0) * 60) } : x)),
    );

  const save = () =>
    run(async () => {
      const r = await saveSlaAction({ policies: rows, start, end, days, extraHolidays: extra });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(
        "Guardamos los tiempos. Aplican a las solicitudes nuevas y a las que cambien de prioridad.",
      );
      router.refresh();
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        <section className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="border-b px-4 py-3 text-left text-base font-semibold">
              Tiempos por prioridad (horas hábiles)
            </caption>
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Prioridad</th>
                <th className="px-4 py-2 font-medium">Primera respuesta</th>
                <th className="px-4 py-2 font-medium">Solución</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.priority}>
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {LABEL[p.priority]}
                  </th>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2">
                      <span className="sr-only">
                        Primera respuesta para prioridad {LABEL[p.priority]}, en horas
                      </span>
                      <Input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={p.firstResponseMinutes / 60}
                        onChange={(e) =>
                          setHours(p.priority, "firstResponseMinutes", e.target.value)
                        }
                        className="w-24"
                      />
                      <span className="text-muted-foreground">h</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2">
                      <span className="sr-only">
                        Solución para prioridad {LABEL[p.priority]}, en horas
                      </span>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={p.resolutionMinutes / 60}
                        onChange={(e) => setHours(p.priority, "resolutionMinutes", e.target.value)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">h</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Horario hábil</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              Abre
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-32"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Cierra
              <Input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-32"
              />
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm">Días hábiles</legend>
              <div className="flex gap-1">
                {DAYS.map((d, i) => {
                  const iso = i + 1;
                  const on = days.includes(iso);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDays((x) => (on ? x.filter((y) => y !== iso) : [...x, iso]))
                      }
                      className={cn(
                        "h-9 w-11 rounded-lg border text-sm",
                        on
                          ? "border-primary bg-secondary font-medium text-secondary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Días no hábiles adicionales</h2>
          <p className="text-sm text-muted-foreground">
            Cierres de la UIS, vacaciones colectivas o paros. Los festivos de ley ya se calculan
            solos.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-44"
              aria-label="Fecha no hábil"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!newDate || extra.includes(newDate)}
              onClick={() => {
                setExtra((x) => [...x, newDate].sort());
                setNewDate("");
              }}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Agregar
            </Button>
          </div>
          {extra.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {extra.map((d) => (
                <li
                  key={d}
                  className="tabular flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-3 text-sm"
                >
                  {d.split("-").reverse().join("/")}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Quitar ${d}`}
                    onClick={() => setExtra((x) => x.filter((y) => y !== d))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Button onClick={save} disabled={pending} size="lg" className="self-start">
          <Save data-icon="inline-start" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar tiempos"}
        </Button>
      </div>
      <aside className="flex flex-col gap-2 rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:self-start">
        <h2 className="text-sm font-semibold">Festivos de Colombia {year}</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {legal.map((h) => (
            <li key={h.date} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{h.name}</span>
              <span className="tabular">{h.date.split("-").reverse().slice(0, 2).join("/")}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
