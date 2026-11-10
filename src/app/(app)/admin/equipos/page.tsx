import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Equipos" };

export default async function EquiposPage() {
  await requireRoute("/admin/equipos");
  return (
    <SectionPlaceholder
      title="Equipos"
      description="Equipos de auxiliares de todos los semestres."
      phase={7}
    />
  );
}
