"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validationError } from "@/shared/domain/errors";
import { err } from "@/shared/domain/result";
import { defineAction } from "@/shared/lib/action";
import { readFormFiles } from "@/shared/storage/uploads";
import {
  assignTicket,
  assignTicketInput,
  changePriorityInput,
  changeStatusInput,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  createTicketInput,
  rateTicket,
  rateTicketInput,
  replyTicket,
  replyTicketInput,
} from "../application/ticket-commands";

/**
 * Server Actions de tickets: capa delgada de presentación.
 * Toda la lógica (validación, permisos, transacción, eventos) vive en los casos de uso.
 */

const formDataSchema = z.instanceof(FormData);

function parsePayload<S extends z.ZodType>(form: FormData, schema: S) {
  try {
    return schema.safeParse(JSON.parse(String(form.get("payload") ?? "{}")));
  } catch {
    return schema.safeParse({});
  }
}

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string[]> = {};
  for (const i of e.issues) (out[i.path.join(".") || "_"] ??= []).push(i.message);
  return out;
}

const refresh = (code?: string) => {
  revalidatePath("/solicitudes");
  revalidatePath("/tickets-asignados");
  revalidatePath("/panel/tickets");
  if (code) revalidatePath(`/solicitudes/${code}`);
};

/** Crear solicitud: payload JSON + archivos por campo de plantilla (`archivo:<clave>`). */
export const createTicketAction = defineAction(formDataSchema, async (form, { c, uc }) => {
  const parsed = parsePayload(form, createTicketInput);
  if (!parsed.success)
    return err(validationError("Revisa los campos marcados.", fieldErrors(parsed.error)));
  const files: Record<string, Awaited<ReturnType<typeof readFormFiles>>> = {};
  for (const key of new Set([...form.keys()].filter((k) => k.startsWith("archivo:")))) {
    files[key.slice("archivo:".length)] = await readFormFiles(form, key);
  }
  const r = await createTicket(c, uc, parsed.data, files);
  if (r.ok) refresh(r.value.code);
  return r;
});

export const replyTicketAction = defineAction(formDataSchema, async (form, { c, uc }) => {
  const parsed = parsePayload(form, replyTicketInput.extend({ code: z.string() }));
  if (!parsed.success) return err(validationError("Revisa el mensaje.", fieldErrors(parsed.error)));
  const files = await readFormFiles(form, "archivos");
  const r = await replyTicket(c, uc, parsed.data, files);
  if (r.ok) refresh(parsed.data.code);
  return r;
});

export const changeStatusAction = defineAction(
  changeStatusInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await changeTicketStatus(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

export const assignTicketAction = defineAction(
  assignTicketInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await assignTicket(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

export const changePriorityAction = defineAction(
  changePriorityInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await changeTicketPriority(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

export const rateTicketAction = defineAction(
  rateTicketInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await rateTicket(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

/** Acciones en lote de la bandeja (HU-41): asignar o cambiar estado a varios tickets. */
export const bulkTicketAction = defineAction(
  z.object({
    ids: z.array(z.uuid()).min(1, "Selecciona al menos una solicitud.").max(100),
    op: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("assign"), assigneeId: z.uuid().nullable() }),
      z.object({ kind: z.literal("status"), to: changeStatusInput.shape.to }),
      z.object({ kind: z.literal("priority"), priority: changePriorityInput.shape.priority }),
    ]),
  }),
  async ({ ids, op }, { c, uc }) => {
    let done = 0;
    const failed: string[] = [];
    for (const ticketId of ids) {
      const r =
        op.kind === "assign"
          ? await assignTicket(c, uc, { ticketId, assigneeId: op.assigneeId })
          : op.kind === "status"
            ? await changeTicketStatus(c, uc, { ticketId, to: op.to })
            : await changeTicketPriority(c, uc, { ticketId, priority: op.priority });
      if (r.ok) done++;
      else failed.push(r.error.message);
    }
    refresh();
    return {
      ok: true as const,
      value: { done, failed: failed.length, reasons: [...new Set(failed)].slice(0, 3) },
    };
  },
);
