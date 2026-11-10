import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  await requireRoute("/notificaciones");
  return (
    <SectionPlaceholder
      title="Notificaciones"
      description="Todo lo que te ha llegado: asignaciones, respuestas y vencimientos."
      phase={4}
    />
  );
}
