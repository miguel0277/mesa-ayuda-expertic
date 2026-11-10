"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { ErrorIllustration } from "./illustrations";

/**
 * Estado de error con "Reintentar". Muestra el código de referencia (digest) para soporte,
 * nunca el detalle técnico del error.
 */
export function ErrorState({
  title = "No pudimos cargar esta sección",
  description = "Puede ser un problema momentáneo de conexión. Inténtalo de nuevo; si sigue pasando, avísale al administrador con el código de referencia.",
  reference,
  onRetry,
}: {
  title?: string;
  description?: string;
  reference?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <ErrorIllustration className="h-32 w-auto" />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {reference && (
          <p className="text-xs text-muted-foreground">
            Código de referencia: <span className="code-id">{reference}</span>
          </p>
        )}
      </div>
      <Button onClick={onRetry}>
        <RotateCcw data-icon="inline-start" aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}
