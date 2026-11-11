import type { Metadata } from "next";
import { EDITABLE_KEYS } from "@/modules/audit/ui/settings-keys";
import { SettingsForm } from "@/modules/audit/ui/settings-form";
import { getEnv } from "@/env";
import { requireRoute } from "@/shared/auth/viewer";
import { getSettings } from "@/shared/config/settings-service";
import { getDb } from "@/shared/db/client";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requireRoute("/admin/ajustes");
  const s = await getSettings(getDb(), EDITABLE_KEYS);
  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Reglas generales de la plataforma. Cada cambio queda en la auditoría."
      />
      <SettingsForm initial={s} envDomains={getEnv().ALLOWED_EMAIL_DOMAINS} />
    </>
  );
}
