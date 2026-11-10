import { Inbox, Plus, Send } from "lucide-react";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/components/empty";
import { Input } from "@/shared/ui/components/input";
import { Skeleton } from "@/shared/ui/components/skeleton";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";
import { NOW } from "./data";

const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

const SWATCHES: { group: string; items: { name: string; cls: string; note: string }[] }[] = [
  {
    group: "Marca (del logo)",
    items: [
      { name: "Azul ExperTIC", cls: "bg-brand-blue", note: "#1673BB: acciones, foco y enlaces" },
      { name: "Verde SEA", cls: "bg-brand-green", note: "#85BE53: acentos y “a tiempo”" },
    ],
  },
  {
    group: "Superficies",
    items: [
      { name: "Fondo", cls: "bg-background", note: "papel frío" },
      { name: "Tarjeta", cls: "bg-card", note: "superficie de trabajo" },
      { name: "Atenuado", cls: "bg-muted", note: "pistas, zonas inactivas" },
      { name: "Tinta", cls: "bg-foreground", note: "texto principal" },
    ],
  },
  {
    group: "Semáforo",
    items: [
      { name: "A tiempo", cls: "bg-ok-fill", note: "texto en verde oscuro AA" },
      { name: "En riesgo", cls: "bg-risk-fill", note: "texto en ámbar oscuro AA" },
      { name: "Atrasada", cls: "bg-late-fill", note: "texto en rojo oscuro AA" },
    ],
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Foundations() {
  return (
    <div className="flex flex-col">
      <Section
        title="Color"
        description="Azul del logo para actuar, verde del logo para lo que va bien. Todo par texto/fondo cumple AA (≥ 4.5:1) en claro y oscuro."
      >
        <div className="flex flex-col gap-5">
          {SWATCHES.map((g) => (
            <div key={g.group} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{g.group}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {g.items.map((s) => (
                  <div key={s.name} className="flex flex-col gap-1.5">
                    <div className={`h-14 rounded-lg border ${s.cls}`} />
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.note}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Tipografía"
        description="IBM Plex Sans para todo; Plex Mono solo para códigos de ticket y tarea. Números tabulares en tablas y contadores."
      >
        <div className="flex flex-col gap-4">
          <p className="text-[1.75rem] leading-tight font-semibold tracking-tight">
            Panel de control
          </p>
          <p className="text-2xl font-semibold tracking-tight">Tus solicitudes</p>
          <p className="text-lg font-semibold">Cumplimiento por auxiliar</p>
          <p className="max-w-prose text-base">
            Cuéntanos qué pasó y en qué curso. Te avisaremos por correo y aquí mismo cuando alguien
            del equipo responda tu solicitud.
          </p>
          <p className="text-sm text-muted-foreground">Texto secundario y metadatos, 14 px.</p>
          <p className="flex items-center gap-4">
            <span className="code-id">EXP-2026-00042</span>
            <span className="code-id">TAR-2026-00107</span>
            <span className="tabular text-sm">1.234 98,5 % 10/11/2026, 3:05 p. m.</span>
          </p>
        </div>
      </Section>

      <Section
        title="Regla de tiempo"
        description="El elemento propio de la app: la misma pista dice “¿vamos a tiempo?” en tickets, tareas y paneles. La marca vertical es el vencimiento."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <StatusSignal signal="a_tiempo" />
            <TimeRail start={h(-24)} due={h(72)} now={NOW} signal="a_tiempo" />
          </div>
          <div className="flex flex-col gap-2">
            <StatusSignal signal="en_riesgo" />
            <TimeRail start={h(-48)} due={h(5)} now={NOW} signal="en_riesgo" />
          </div>
          <div className="flex flex-col gap-2">
            <StatusSignal signal="atrasada" />
            <TimeRail start={h(-96)} due={h(-30)} now={NOW} signal="atrasada" />
          </div>
          <div className="flex flex-col gap-2">
            <StatusSignal signal="atrasada" label="Cumplida tarde" />
            <TimeRail
              start={h(-96)}
              due={h(-50)}
              completedAt={h(-20)}
              now={NOW}
              signal="atrasada"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Controles"
        description="Altura de 36 px (40 px en acciones principales). Al presionar, escala a 0.98. Foco siempre visible."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg">
              <Send data-icon="inline-start" aria-hidden="true" />
              Enviar solicitud
            </Button>
            <Button>Guardar cambios</Button>
            <Button variant="secondary">Asignarme</Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="ghost">Ver historial</Button>
            <Button variant="destructive">Eliminar adjunto</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Abierto</Badge>
            <Badge variant="brand">En progreso</Badge>
            <Badge variant="secondary">Respondido</Badge>
            <Badge variant="late">Prioridad alta</Badge>
            <Badge variant="risk">Prioridad media</Badge>
            <Badge variant="outline">Prioridad baja</Badge>
          </div>
          <Input
            placeholder="Ej.: Cálculo Diferencial – Grupo B1"
            aria-label="Curso"
            className="max-w-sm"
          />
        </div>
      </Section>

      <Section
        title="Estados"
        description="Cada vista tiene carga (con la forma real), vacío (con la acción principal) y error. Los skeletons repiten la silueta de lo que viene."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="flex flex-col gap-3 rounded-xl border bg-card p-4"
            aria-busy="true"
            aria-label="Cargando tickets"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-1.5 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Aún no tienes solicitudes</EmptyTitle>
              <EmptyDescription>
                Cuando algo falle en un curso o necesites apoyo del equipo, crea una solicitud y
                síguela desde aquí.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Nueva solicitud
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </Section>
    </div>
  );
}
