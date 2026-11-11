"use server";

import { revalidatePath, updateTag } from "next/cache";
import { DASHBOARD_TAG } from "@/modules/reports/infrastructure/dashboard";
import { defineAction } from "@/shared/lib/action";
import {
  saveSla,
  saveTicketType,
  slaInput,
  ticketTypeInput,
} from "../application/template-commands";

export const saveTicketTypeAction = defineAction(ticketTypeInput, async (input, { c, uc }) => {
  const r = await saveTicketType(c, uc, input);
  if (r.ok) {
    updateTag(DASHBOARD_TAG);
    revalidatePath("/panel/plantillas");
    revalidatePath("/solicitudes/nueva");
  }
  return r;
});

export const saveSlaAction = defineAction(slaInput, async (input, { c, uc }) => {
  const r = await saveSla(c, uc, input);
  if (r.ok) revalidatePath("/panel/plantillas");
  return r;
});
