import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Auxiliares y equipos" };

export default async function AuxiliaresYEquiposPage() {
  await requireRoute("/panel/auxiliares");
  return (
    <SectionPlaceholder
      title="Auxiliares y equipos"
      description="Aprueba cuentas, otorga roles y arma los equipos de cada semestre."
      phase={6}
    />
  );
}
