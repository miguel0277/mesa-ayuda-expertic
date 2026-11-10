import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function MiPerfilPage() {
  await requireRoute("/perfil");
  return (
    <SectionPlaceholder
      title="Mi perfil"
      description="Tu nombre, foto, teléfono y contraseña."
      phase={3}
    />
  );
}
