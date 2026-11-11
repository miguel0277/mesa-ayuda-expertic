"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/shared/auth/permissions";
import { getSettings, setSetting } from "@/shared/config/settings-service";
import { settingsSchemas } from "@/shared/config/settings";
import { forbidden } from "@/shared/domain/errors";
import { err, ok } from "@/shared/domain/result";
import { appEvent } from "@/shared/kernel/app-event";
import { unitOfWork } from "@/shared/kernel/use-case";
import { defineAction } from "@/shared/lib/action";
import { EDITABLE_KEYS } from "./settings-keys";

const input = z.object({
  "auth.allowedEmailDomains": settingsSchemas["auth.allowedEmailDomains"],
  "registration.approvalRoles": settingsSchemas["registration.approvalRoles"],
  "attachments.maxSizeMB": settingsSchemas["attachments.maxSizeMB"],
  "tasks.riskThresholdHours": settingsSchemas["tasks.riskThresholdHours"],
  "tickets.autoCloseDays": settingsSchemas["tickets.autoCloseDays"],
  "tickets.reopenWindowDays": settingsSchemas["tickets.reopenWindowDays"],
  "privacy.noticeVersion": z.string().trim().min(3).max(60),
});

/** Ajustes del sistema (solo admin). Cada cambio queda en la auditoría con antes y después. */
export const saveSettingsAction = defineAction(input, async (values, { c, uc, viewer }) => {
  if (!can(viewer, "settings.manage")) return err(forbidden());
  const before = await getSettings(c.db, EDITABLE_KEYS);
  const changed = EDITABLE_KEYS.filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(values[k]),
  );
  if (!changed.length) return ok({ changed: 0 });
  await unitOfWork(c, async (tx, emit) => {
    for (const k of changed) await setSetting(tx, k, values[k] as never, viewer.id);
    emit(
      appEvent(
        "settings.updated",
        uc,
        { type: "setting", id: "app" },
        {
          before: Object.fromEntries(changed.map((k) => [k, before[k]])),
          after: Object.fromEntries(changed.map((k) => [k, values[k]])),
        },
      ),
    );
  });
  revalidatePath("/admin/ajustes");
  return ok({ changed: changed.length });
});
