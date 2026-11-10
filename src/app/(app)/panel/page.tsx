import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Panel de control" };

export default async function PanelDeControlPage() {
  await requireRoute("/panel");
  return (
    <SectionPlaceholder
      title="Panel de control"
      description="Quién va a tiempo y quién va atrasado, de un vistazo."
      phase={6}
    />
  );
}
