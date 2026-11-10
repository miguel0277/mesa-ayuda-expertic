import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportesPage() {
  await requireRoute("/panel/reportes");
  return (
    <SectionPlaceholder
      title="Reportes"
      description="Exporta tickets y tareas a CSV o Excel por rango de fechas."
      phase={6}
    />
  );
}
