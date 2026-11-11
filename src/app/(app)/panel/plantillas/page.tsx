import { asc, isNull } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SlaEditor } from "@/modules/templates/ui/sla-editor";
import { TemplateEditor, type TypeDraft } from "@/modules/templates/ui/template-editor";
import { CategoryTile } from "@/modules/tickets/ui/badges";
import { requireRoute } from "@/shared/auth/viewer";
import { getSetting } from "@/shared/config/settings-service";
import { getDb } from "@/shared/db/client";
import { slaPolicies, ticketTypes } from "@/shared/db/schema";
import { cn } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Plantillas y SLA" };

const EMPTY: TypeDraft = {
  id: null,
  name: "",
  slug: "",
  description: "",
  icon: "circle-help",
  color: "#1673BB",
  defaultPriority: "media",
  active: true,
  sortOrder: 10,
  fields: [],
};

/** Editor de plantillas de tickets y configuración de SLA (HU-44). */
export default async function PlantillasPage({ searchParams }: PageProps<"/panel/plantillas">) {
  await requireRoute("/panel/plantillas");
  const sp = await searchParams;
  const tab = sp.ver === "sla" ? "sla" : "categorias";
  const db = getDb();
  const types = await db
    .select()
    .from(ticketTypes)
    .where(isNull(ticketTypes.deletedAt))
    .orderBy(asc(ticketTypes.sortOrder));
  const selected =
    sp.tipo === "nueva" ? null : (types.find((t) => t.id === sp.tipo) ?? types[0] ?? null);
  const draft: TypeDraft = selected
    ? {
        id: selected.id,
        name: selected.name,
        slug: selected.slug,
        description: selected.description,
        icon: selected.icon,
        color: selected.color,
        defaultPriority: selected.defaultPriority,
        active: selected.active,
        sortOrder: selected.sortOrder,
        fields: selected.fields,
      }
    : { ...EMPTY, sortOrder: types.length + 1 };

  const policies = tab === "sla" ? await db.select().from(slaPolicies) : [];
  const extra = tab === "sla" ? await getSetting(db, "sla.extraHolidays") : [];
  const order = { alta: 0, media: 1, baja: 2 } as const;
  const hours = policies[0]?.businessHours ?? {
    start: "07:00",
    end: "18:00",
    days: [1, 2, 3, 4, 5],
    timezone: "America/Bogota",
  };

  return (
    <>
      <PageHeader
        title="Plantillas y SLA"
        description="Define qué preguntas tiene cada categoría de solicitud y en cuánto tiempo deben atenderse."
      />
      <nav aria-label="Secciones" className="mb-6 tab-strip">
        {[
          { key: "categorias", label: "Categorías", href: "/panel/plantillas" },
          { key: "sla", label: "Tiempos de atención (SLA)", href: "/panel/plantillas?ver=sla" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className="tab-item"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "sla" ? (
        <SlaEditor
          policies={[...policies]
            .sort((a, b) => order[a.priority] - order[b.priority])
            .map((p) => ({
              priority: p.priority,
              firstResponseMinutes: p.firstResponseMinutes,
              resolutionMinutes: p.resolutionMinutes,
            }))}
          start={hours.start}
          end={hours.end}
          days={hours.days}
          extraHolidays={extra}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Categorías" className="flex flex-col gap-1">
            {types.map((t) => (
              <Link
                key={t.id}
                href={`/panel/plantillas?tipo=${t.id}`}
                aria-current={selected?.id === t.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-accent",
                  selected?.id === t.id && "bg-secondary font-medium text-secondary-foreground",
                  !t.active && "opacity-60",
                )}
              >
                <CategoryTile icon={t.icon} color={t.color} name={t.name} size="sm" />
                <span className="flex-1 truncate">{t.name}</span>
                {!t.active && <span className="text-xs">inactiva</span>}
              </Link>
            ))}
            <Link
              href="/panel/plantillas?tipo=nueva"
              aria-current={!selected ? "page" : undefined}
              className={cn(
                "mt-1 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                !selected && "border-primary text-foreground",
              )}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nueva categoría
            </Link>
          </nav>
          <TemplateEditor key={draft.id ?? "nueva"} initial={draft} />
        </div>
      )}
    </>
  );
}
