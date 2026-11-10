import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Tareas del equipo" };

export default async function TareasDelEquipoPage() {
  await requireRoute("/panel/tareas");
  return (
    <SectionPlaceholder
      title="Tareas del equipo"
      description="Crea y asigna tareas a una persona o a un equipo, con fecha límite y prioridad."
      phase={6}
    />
  );
}
