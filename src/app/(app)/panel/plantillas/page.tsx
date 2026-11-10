import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Plantillas y SLA" };

export default async function PlantillasYSLAPage() {
  await requireRoute("/panel/plantillas");
  return (
    <SectionPlaceholder
      title="Plantillas y SLA"
      description="Define los campos de cada categoría de ticket y los tiempos de respuesta."
      phase={6}
    />
  );
}
