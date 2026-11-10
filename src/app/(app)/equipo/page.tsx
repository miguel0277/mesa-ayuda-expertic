import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Mi equipo" };

export default async function MiEquipoPage() {
  await requireRoute("/equipo");
  return (
    <SectionPlaceholder
      title="Mi equipo"
      description="El avance de cada auxiliar de tu equipo, lo vencido y lo próximo."
      phase={5}
    />
  );
}
