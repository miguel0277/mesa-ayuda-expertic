"use client";

import { useEffect } from "react";
import { ErrorState } from "@/shared/ui/error-state";

/** Error dentro del shell: el menú sigue disponible y se ofrece reintentar. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState reference={error.digest} onRetry={retry} />;
}
