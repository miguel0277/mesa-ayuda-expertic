import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

const CODE = /^EXP-\d{4}-\d{5}$/;

// Metadata estática: con Cache Components, leer `params` aquí bloquearía el prerenderizado.
export const metadata: Metadata = { title: "Detalle de la solicitud" };

/** Detalle de un ticket. Fase 4: el acceso real lo decide can() según dueño, asignado y equipo. */
export default async function TicketDetailPage({ params }: PageProps<"/solicitudes/[code]">) {
  await requireViewer();
  const code = (await params).code.toUpperCase();
  if (!CODE.test(code)) notFound();
  return (
    <SectionPlaceholder
      title={`Solicitud ${code}`}
      description="Hilo de mensajes, adjuntos, línea de tiempo y estado del SLA de esta solicitud."
      phase={4}
    />
  );
}
