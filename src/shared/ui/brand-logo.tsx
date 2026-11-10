import Image from "next/image";
import { cn } from "@/shared/lib/utils";

/**
 * Logo oficial de ExperTIC (D-008).
 * El logo trae "TIC" en negro: en modo oscuro se apoya sobre una placa clara
 * para no perder contraste, hasta que exista una versión para fondos oscuros.
 */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md dark:bg-white dark:px-1.5 dark:py-1",
        className,
      )}
    >
      <Image
        src="/brand/logo-expertic.png"
        alt="ExperTIC"
        width={447}
        height={120}
        priority={priority}
        className="h-full w-auto"
      />
    </span>
  );
}
