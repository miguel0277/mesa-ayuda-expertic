import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Mis tareas" };

export default async function MisTareasPage() {
  await requireRoute("/tareas");
  return (
    <SectionPlaceholder
      title="Mis tareas"
      description="Tus tareas en tablero o lista, con su semáforo y la evidencia de lo que ya hiciste."
      phase={5}
    />
  );
}
