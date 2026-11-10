import type { Metadata } from "next";
import { TicketInbox } from "@/modules/tickets/ui/ticket-inbox";
import { requireRoute } from "@/shared/auth/viewer";

export const metadata: Metadata = { title: "Mis solicitudes" };

export default async function MisSolicitudesPage({ searchParams }: PageProps<"/solicitudes">) {
  const viewer = await requireRoute("/solicitudes");
  return (
    <TicketInbox
      viewer={viewer}
      scope="mine"
      basePath="/solicitudes"
      title="Tus solicitudes"
      description="Sigue el estado de lo que pediste, responde al equipo y califica la atención."
      searchParams={searchParams}
      showRequester={false}
    />
  );
}
