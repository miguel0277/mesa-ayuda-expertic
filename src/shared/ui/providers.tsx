"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "@/shared/ui/components/sonner";
import { TooltipProvider } from "@/shared/ui/components/tooltip";

/**
 * Proveedores globales de UI:
 * - Tema claro/oscuro/sistema (clase `.dark` en <html>).
 * - Motion respeta `prefers-reduced-motion` automáticamente.
 * - Tooltips con un retraso corto y consistente, y toasts (sonner).
 * - nuqs: filtros, pestañas y paginación en la URL (compartibles).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </NuqsAdapter>
      </MotionConfig>
    </ThemeProvider>
  );
}
