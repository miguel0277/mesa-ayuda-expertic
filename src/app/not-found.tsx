import type { Metadata } from "next";
import { NotFoundView } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <NotFoundView />
    </main>
  );
}
