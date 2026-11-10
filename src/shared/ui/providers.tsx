"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/shared/ui/components/sonner";
import { TooltipProvider } from "@/shared/ui/components/tooltip";

/**
 * Proveedores globales de UI:
 * - Tema claro/oscuro/sistema (clase `.dark` en <html>).
 * - Motion respeta `prefers-reduced-motion` automáticamente.
 * - Tooltips con un retraso corto y consistente, y toasts (sonner).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
