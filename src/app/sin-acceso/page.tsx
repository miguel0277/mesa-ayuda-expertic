import type { Metadata } from "next";
import { ForbiddenView } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Sin acceso", robots: { index: false } };

/** Destino del proxy cuando el rol no puede ver una ruta (responde 403). */
export default function SinAccesoPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ForbiddenView />
    </main>
  );
}
