import type { Metadata } from "next";
import { TicketInbox } from "@/modules/tickets/ui/ticket-inbox";
import { requireRoute } from "@/shared/auth/viewer";

export const metadata: Metadata = { title: "Bandeja de tickets" };

export default async function BandejaPage({ searchParams }: PageProps<"/panel/tickets">) {
  const viewer = await requireRoute("/panel/tickets");
  return (
    <TicketInbox
      viewer={viewer}
      scope="all"
      basePath="/panel/tickets"
      title="Bandeja de tickets"
      description="Todas las solicitudes. Selecciona varias para asignarlas, cambiar su prioridad o cerrarlas de una vez."
      searchParams={searchParams}
      selectable
    />
  );
}
