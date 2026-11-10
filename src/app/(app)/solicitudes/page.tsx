import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Mis solicitudes" };

export default async function MisSolicitudesPage() {
  await requireRoute("/solicitudes");
  return (
    <SectionPlaceholder
      title="Mis solicitudes"
      description="Sigue el estado de lo que has pedido, responde al equipo y califica la atención."
      phase={4}
    />
  );
}
