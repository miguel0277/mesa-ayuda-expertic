"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

/** Solicitudes por categoría: barras horizontales con el color de cada categoría y el valor rotulado. */
export function TicketsByTypeChart({
  data,
}: {
  data: { name: string; color: string; n: number }[];
}) {
  const config = { n: { label: "Solicitudes", color: "var(--chart-1)" } } satisfies ChartConfig;
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 32, top: 4, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={<ChartTooltipContent hideLabel={false} />}
          />
          <Bar dataKey="n" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
            <LabelList
              dataKey="n"
              position="right"
              className="fill-foreground text-xs tabular-nums"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">
        {total} solicitudes en el periodo: {data.map((d) => `${d.name}, ${d.n}`).join("; ")}.
      </figcaption>
    </figure>
  );
}

/** Solicitudes creadas vs. cerradas por semana (últimas 8 semanas). */
export function TicketsByWeekChart({
  data,
}: {
  data: { week: string; created: number; closed: number }[];
}) {
  const config = {
    created: { label: "Creadas", color: "var(--chart-1)" },
    closed: { label: "Cerradas", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const fmt = (w: string) => {
    const [, m, d] = w.split("-");
    return `${d}/${m}`;
  };
  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart
          data={data}
          margin={{ left: -16, right: 8, top: 8, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="week"
            tickFormatter={fmt}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={<ChartTooltipContent labelFormatter={(w) => `Semana del ${fmt(String(w))}`} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="created"
            fill="var(--color-created)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar dataKey="closed" fill="var(--color-closed)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">
        {data
          .map((d) => `Semana del ${fmt(d.week)}: ${d.created} creadas y ${d.closed} cerradas`)
          .join(". ")}
        .
      </figcaption>
    </figure>
  );
}
