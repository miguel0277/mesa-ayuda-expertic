import type { Metadata } from "next";
import { requireRoute } from "@/shared/auth/viewer";
import { SectionPlaceholder } from "@/shared/ui/section-placeholder";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditoriaPage() {
  await requireRoute("/admin/auditoria");
  return (
    <SectionPlaceholder
      title="Auditoría"
      description="Quién cambió qué y cuándo, con el antes y el después."
      phase={7}
    />
  );
}
