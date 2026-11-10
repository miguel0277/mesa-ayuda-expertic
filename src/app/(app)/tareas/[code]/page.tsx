import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

const CODE = /^TAR-\d{4}-\d{5}$/;

// Metadata estática: con Cache Components, leer `params` aquí bloquearía el prerenderizado.
export const metadata: Metadata = { title: "Detalle de la tarea" };

export default async function TaskDetailPage({ params }: PageProps<"/tareas/[code]">) {
  await requireRoute("/tareas");
  const code = (await params).code.toUpperCase();
  if (!CODE.test(code)) notFound();
  return (
    <SectionPlaceholder
      title={`Tarea ${code}`}
      description="Detalle de la tarea, su evidencia y su historial."
      phase={5}
    />
  );
}
