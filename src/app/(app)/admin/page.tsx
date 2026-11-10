import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Consola" };

export default async function ConsolaPage() {
  await requireRoute("/admin");
  return (
    <SectionPlaceholder
      title="Consola"
      description="Acceso a todo lo que gestiona el administrador."
      phase={7}
    />
  );
}
