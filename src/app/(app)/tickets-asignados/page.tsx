import type { Metadata } from "next";
import { TicketInbox } from "@/modules/tickets/ui/ticket-inbox";
import { requireRoute } from "@/shared/auth/viewer";

export const metadata: Metadata = { title: "Tickets asignados" };

export default async function TicketsAsignadosPage({
  searchParams,
}: PageProps<"/tickets-asignados">) {
  const viewer = await requireRoute("/tickets-asignados");
  return (
    <TicketInbox
      viewer={viewer}
      scope="assigned"
      basePath="/tickets-asignados"
      title="Tickets asignados"
      description="Las solicitudes que te asignaron. Respóndelas, deja notas internas y cambia su estado."
      searchParams={searchParams}
    />
  );
}
