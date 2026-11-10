import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Salud del sistema" };

export default async function SaludDelSistemaPage() {
  await requireRoute("/admin/sistema");
  return (
    <SectionPlaceholder
      title="Salud del sistema"
      description="Estado de la base de datos, últimos errores y versión desplegada."
      phase={7}
    />
  );
}
