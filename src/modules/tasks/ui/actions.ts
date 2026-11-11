"use server";

import { revalidatePath, updateTag } from "next/cache";
import { DASHBOARD_TAG } from "@/modules/reports/infrastructure/dashboard";
import { z } from "zod";
import { validationError } from "@/shared/domain/errors";
import { err } from "@/shared/domain/result";
import { defineAction } from "@/shared/lib/action";
import { readFormFiles } from "@/shared/storage/uploads";
import {
  addEvidence,
  addEvidenceInput,
  changeTaskStatus,
  changeTaskStatusInput,
  createTask,
  createTaskInput,
  reassignTask,
  reassignTaskInput,
} from "../application/task-commands";

const refresh = (code?: string) => {
  updateTag(DASHBOARD_TAG);
  revalidatePath("/tareas");
  revalidatePath("/equipo");
  revalidatePath("/panel/tareas");
  revalidatePath("/panel");
  if (code) revalidatePath(`/tareas/${code}`);
};

export const createTaskAction = defineAction(createTaskInput, async (input, { c, uc }) => {
  const r = await createTask(c, uc, input);
  if (r.ok) refresh();
  return r;
});

export const changeTaskStatusAction = defineAction(
  changeTaskStatusInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await changeTaskStatus(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

export const reassignTaskAction = defineAction(
  reassignTaskInput.extend({ code: z.string() }),
  async (input, { c, uc }) => {
    const r = await reassignTask(c, uc, input);
    if (r.ok) refresh(input.code);
    return r;
  },
);

/** Evidencia: payload JSON + archivos (`archivos`). */
export const addEvidenceAction = defineAction(z.instanceof(FormData), async (form, { c, uc }) => {
  let payload: unknown = {};
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    payload = {};
  }
  const parsed = addEvidenceInput.extend({ code: z.string() }).safeParse(payload);
  if (!parsed.success) return err(validationError("Revisa la evidencia."));
  const files = await readFormFiles(form, "archivos");
  const r = await addEvidence(c, uc, parsed.data, files);
  if (r.ok) refresh(parsed.data.code);
  return r;
});
