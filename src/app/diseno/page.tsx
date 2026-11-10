import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { Foundations } from "./_preview/foundations";
import { ShellPreview } from "./_preview/shell-preview";

export const metadata: Metadata = { title: "Sistema de diseño" };

/**
 * /diseno — muestra del sistema de diseño "Bitácora" para aprobación (Fase 2).
 * Solo existe en desarrollo: en producción responde 404.
 */
export default function DisenoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-10" priority />
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">Bitácora</h1>
            <p className="text-sm text-muted-foreground">
              Dirección visual de la Mesa de Ayuda, propuesta para aprobación
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <ShellPreview />
      <Foundations />
    </div>
  );
}
