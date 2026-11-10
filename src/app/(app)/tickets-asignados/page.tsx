import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Tickets asignados" };

export default async function TicketsAsignadosPage() {
  await requireRoute("/tickets-asignados");
  return (
    <SectionPlaceholder
      title="Tickets asignados"
      description="Las solicitudes que te asignaron: responde, deja notas internas y cambia su estado."
      phase={4}
    />
  );
}
