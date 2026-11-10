import { eq, inArray } from "drizzle-orm";
import { appSettings } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import { defaultSetting, settingsSchemas, type SettingKey, type SettingValue } from "./settings";

/** Lee un ajuste validado; si falta o es inválido, usa el valor por defecto. */
export async function getSetting<K extends SettingKey>(
  db: DbExecutor,
  key: K,
): Promise<SettingValue<K>> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  const parsed = settingsSchemas[key].safeParse(row?.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : defaultSetting(key);
}

/** Lee varios ajustes en una sola consulta. */
export async function getSettings<K extends SettingKey>(
  db: DbExecutor,
  keys: readonly K[],
): Promise<{ [P in K]: SettingValue<P> }> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, keys as unknown as string[]));
  const out = {} as { [P in K]: SettingValue<P> };
  for (const key of keys) {
    const parsed = settingsSchemas[key].safeParse(rows.find((r) => r.key === key)?.value);
    out[key] = (parsed.success ? parsed.data : defaultSetting(key)) as SettingValue<typeof key>;
  }
  return out;
}

/** Guarda un ajuste validado. */
export async function setSetting<K extends SettingKey>(
  db: DbExecutor,
  key: K,
  value: SettingValue<K>,
  actorId: string | null,
): Promise<void> {
  const valid = settingsSchemas[key].parse(value);
  await db
    .insert(appSettings)
    .values({ key, value: valid, updatedBy: actorId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: valid, updatedBy: actorId, updatedAt: new Date() },
    });
}
