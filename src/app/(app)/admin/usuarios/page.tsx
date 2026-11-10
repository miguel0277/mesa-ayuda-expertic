import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  await requireRoute("/admin/usuarios");
  return (
    <SectionPlaceholder
      title="Usuarios"
      description="Crea, edita, bloquea y cambia el rol de cualquier persona. Revisa la app como la ve otro rol."
      phase={7}
    />
  );
}
