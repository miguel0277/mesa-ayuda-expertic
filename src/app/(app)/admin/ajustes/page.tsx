import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requireRoute("/admin/ajustes");
  return (
    <SectionPlaceholder
      title="Ajustes"
      description="Dominios de correo, tamaño de adjuntos, umbral de riesgo y autocierre."
      phase={7}
    />
  );
}
