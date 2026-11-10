import type { Metadata } from "next";
import { activeTicketTypes } from "@/modules/tickets/infrastructure/ticket-queries";
import { NewTicketFlow } from "@/modules/tickets/ui/new-ticket-form";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default async function NuevaSolicitudPage() {
  await requireRoute("/solicitudes/nueva");
  const types = await activeTicketTypes(getDb());
  return (
    <>
      <PageHeader
        title="Nueva solicitud"
        description="Elige la categoría que mejor describe lo que necesitas."
      />
      <NewTicketFlow types={types} />
    </>
  );
}
