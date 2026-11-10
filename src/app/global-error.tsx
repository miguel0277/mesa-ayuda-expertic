"use client";

import "./globals.css";
import { ErrorState } from "@/shared/ui/error-state";

/**
 * Error en el layout raíz. Reemplaza todo el documento, así que trae su propio <html>.
 * Sigue el tema del sistema operativo (no hay acceso a la preferencia guardada).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es-CO">
      <body className="flex min-h-svh flex-col bg-background font-sans text-foreground">
        <title>Algo salió mal · Mesa de Ayuda ExperTIC</title>
        <ErrorState
          title="La aplicación no pudo cargar"
          description="Inténtalo de nuevo en unos segundos. Si sigue pasando, avísale al administrador con el código de referencia."
          reference={error.digest}
          onRetry={retry}
        />
      </body>
    </html>
  );
}
