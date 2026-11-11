import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/modules/users/ui/profile-forms";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { user } from "@/shared/db/schema";
import { formatDateTime } from "@/shared/lib/dates";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Mi perfil" };

/** Mi perfil (HU-03): datos, foto y contraseña. */
export default async function PerfilPage() {
  const viewer = await requireRoute("/perfil");
  const [u] = await getDb().select().from(user).where(eq(user.id, viewer.id)).limit(1);
  if (!u) return null;
  return (
    <>
      <PageHeader
        title="Mi perfil"
        description={`${viewer.roleLabel} · cuenta creada el ${formatDateTime(u.createdAt)}`}
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ProfileForm
          profile={{
            name: u.name,
            email: u.email,
            telefono: u.telefono,
            programa: u.programa,
            codigoUis: u.codigoUis,
            image: u.image,
          }}
        />
        <div className="flex flex-col gap-6">
          <PasswordForm />
          <section className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
            <p className="text-muted-foreground">
              {u.dataConsentAt
                ? `Aceptaste el aviso de tratamiento de datos (versión ${u.dataConsentVersion}) el ${formatDateTime(u.dataConsentAt)}.`
                : "Tu cuenta fue creada por el administrador."}{" "}
              Para ejercer tus derechos sobre tus datos (Ley 1581 de 2012) escríbele al equipo de
              ExperTIC.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
