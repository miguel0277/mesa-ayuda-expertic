import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Bandeja de tickets" };

export default async function BandejaDeTicketsPage() {
  await requireRoute("/panel/tickets");
  return (
    <SectionPlaceholder
      title="Bandeja de tickets"
      description="Todas las solicitudes, con filtros, asignación rápida y acciones en lote."
      phase={6}
    />
  );
}
