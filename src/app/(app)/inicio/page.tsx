import { redirect } from "next/navigation";
import { requireViewer } from "@/shared/auth/viewer";
import { homeFor } from "@/shared/ui/shell/nav";

/** /inicio: lleva a cada rol a su panel (sección 7). */
export default async function InicioPage() {
  const viewer = await requireViewer();
  redirect(homeFor(viewer.role));
}
