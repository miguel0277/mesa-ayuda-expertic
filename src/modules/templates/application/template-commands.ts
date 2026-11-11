import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { can } from "@/shared/auth/permissions";
import { setSetting } from "@/shared/config/settings-service";
import { slaPolicies, ticketTypes } from "@/shared/db/schema";
import { PRIORITIES } from "@/shared/db/schema/enums";
import {
  conflict,
  forbidden,
  notFound,
  validationError,
  type DomainError,
} from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import { appEvent, type UseCaseContext } from "@/shared/kernel/app-event";
import type { Container } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";
import { CATEGORY_ICONS } from "@/shared/ui/category-icon";
import { templateFieldsSchema } from "../domain/template-field";

type Deps = Pick<Container, "db" | "events" | "email" | "logger" | "clock" | "ids">;

export const ticketTypeInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(3, "Escribe un nombre.").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones (ej.: errores-moodle)."),
  description: z.string().trim().max(240),
  icon: z.enum(Object.keys(CATEGORY_ICONS) as [string, ...string[]]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Elige un color."),
  defaultPriority: z.enum(PRIORITIES),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  fields: templateFieldsSchema,
});

/** Crear o actualizar un tipo de ticket con su plantilla (HU-44). */
export async function saveTicketType(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof ticketTypeInput>,
): Promise<Result<{ id: string }, DomainError>> {
  if (!can(ctx.actor, "templates.manage")) return err(forbidden());
  const [dupe] = await c.db
    .select({ id: ticketTypes.id })
    .from(ticketTypes)
    .where(
      and(eq(ticketTypes.slug, input.slug), input.id ? ne(ticketTypes.id, input.id) : undefined),
    )
    .limit(1);
  if (dupe)
    return err(
      validationError("Ya existe una categoría con ese identificador.", {
        slug: ["Elige otro identificador."],
      }),
    );

  const id = input.id ?? c.ids.next();
  const before = input.id
    ? (await c.db.select().from(ticketTypes).where(eq(ticketTypes.id, input.id)).limit(1))[0]
    : null;
  if (input.id && !before) return err(notFound("esa categoría"));
  const values = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    icon: input.icon,
    color: input.color.toUpperCase(),
    defaultPriority: input.defaultPriority,
    active: input.active,
    sortOrder: input.sortOrder,
    fields: input.fields,
    updatedAt: ctx.now,
    updatedBy: ctx.actor.id,
  };
  await unitOfWork(c, async (tx, emit) => {
    if (before) await tx.update(ticketTypes).set(values).where(eq(ticketTypes.id, id));
    else
      await tx
        .insert(ticketTypes)
        .values({ id, ...values, createdAt: ctx.now, createdBy: ctx.actor.id });
    emit(
      appEvent(
        before ? "ticket_type.updated" : "ticket_type.created",
        ctx,
        { type: "ticket_type", id },
        {
          before: before
            ? { name: before.name, active: before.active, fields: before.fields.map((f) => f.key) }
            : null,
          after: {
            name: values.name,
            active: values.active,
            fields: values.fields.map((f) => f.key),
          },
        },
      ),
    );
  });
  return ok({ id });
}

export const slaInput = z.object({
  policies: z
    .array(
      z.object({
        priority: z.enum(PRIORITIES),
        firstResponseMinutes: z
          .number()
          .int()
          .min(15, "Mínimo 15 minutos.")
          .max(60 * 24 * 30),
        resolutionMinutes: z
          .number()
          .int()
          .min(30)
          .max(60 * 24 * 60),
      }),
    )
    .length(3),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(1).max(7)).min(1, "Elige al menos un día hábil."),
  extraHolidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
});

/** Configuración de SLA: tiempos por prioridad, horario hábil y festivos extra. */
export async function saveSla(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof slaInput>,
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "sla.manage")) return err(forbidden());
  if (input.start >= input.end)
    return err(validationError("La hora de cierre debe ser después de la de apertura."));
  for (const p of input.policies)
    if (p.resolutionMinutes < p.firstResponseMinutes)
      return err(
        conflict(
          `En prioridad ${p.priority}, la solución no puede tomar menos que la primera respuesta.`,
        ),
      );
  const before = await c.db.select().from(slaPolicies);
  await unitOfWork(c, async (tx, emit) => {
    for (const p of input.policies) {
      await tx
        .update(slaPolicies)
        .set({
          firstResponseMinutes: p.firstResponseMinutes,
          resolutionMinutes: p.resolutionMinutes,
          businessHours: {
            timezone: "America/Bogota",
            days: [...input.days].sort(),
            start: input.start,
            end: input.end,
          },
          updatedAt: ctx.now,
          updatedBy: ctx.actor.id,
        })
        .where(eq(slaPolicies.priority, p.priority));
    }
    await setSetting(tx, "sla.extraHolidays", input.extraHolidays, ctx.actor.id);
    emit(
      appEvent(
        "sla.updated",
        ctx,
        { type: "sla_policy", id: "global" },
        {
          before: before.map((b) => ({
            priority: b.priority,
            firstResponseMinutes: b.firstResponseMinutes,
            resolutionMinutes: b.resolutionMinutes,
          })),
          after: { ...input },
        },
      ),
    );
  });
  return ok(true);
}
