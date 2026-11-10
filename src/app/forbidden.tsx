import type { Metadata } from "next";
import { ForbiddenView } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Sin acceso" };

/** 403 amable: se muestra cuando una página o acción llama a `forbidden()`. */
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col">
      <ForbiddenView />
    </main>
  );
}
