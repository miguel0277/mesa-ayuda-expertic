import { z } from "zod";

/**
 * Ajustes editables guardados en `app_settings` (clave → valor JSONB).
 * Cada clave tiene su esquema y valor por defecto; si la fila no existe se usa el defecto.
 */
export const settingsSchemas = {
  "auth.allowedEmailDomains": z.array(z.string()).default([]),
  "registration.requireApproval": z
    .object({ estudiante: z.boolean(), profesor: z.boolean() })
    .default({ estudiante: true, profesor: true }),
  "privacy.noticeVersion": z.string().default("2026-11-v1-provisional"),
  "attachments.maxSizeMB": z.number().int().min(1).max(50).default(10),
  "attachments.allowedMime": z
    .array(z.string())
    .default([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
    ]),
  "tasks.riskThresholdHours": z.number().min(1).max(240).default(24),
  "tickets.autoCloseDays": z.number().int().min(1).max(60).default(5),
  "tickets.reopenWindowDays": z.number().int().min(1).max(60).default(7),
  "sla.extraHolidays": z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
} as const;

export type SettingKey = keyof typeof settingsSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsSchemas)[K]>;

export function defaultSetting<K extends SettingKey>(key: K): SettingValue<K> {
  return settingsSchemas[key].parse(undefined) as SettingValue<K>;
}

export function allDefaultSettings(): { key: SettingKey; value: unknown }[] {
  return (Object.keys(settingsSchemas) as SettingKey[]).map((key) => ({
    key,
    value: defaultSetting(key),
  }));
}
