import { Hammer } from "lucide-react";
import { EmptyState, PageHeader } from "./states";

/**
 * Sección que existe en el mapa de rutas pero aún no se construye.
 * Dice con honestidad qué hará y en qué fase llega; no muestra datos inventados.
 */
export function SectionPlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Hammer}
        title="Esta sección está en construcción"
        description={`Llega en la fase ${phase} del proyecto. Mientras tanto, puedes moverte por el menú o buscar con Ctrl K.`}
      />
    </>
  );
}
