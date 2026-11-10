import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default async function NuevaSolicitudPage() {
  await requireRoute("/solicitudes/nueva");
  return (
    <SectionPlaceholder
      title="Nueva solicitud"
      description="Elige la categoría y cuéntanos qué necesitas. Te daremos un código para seguirla."
      phase={4}
    />
  );
}
