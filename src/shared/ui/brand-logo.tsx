import Image from "next/image";
import { cn } from "@/shared/lib/utils";

/**
 * Logo oficial de ExperTIC (D-008) con su versión para fondos oscuros (D-026).
 * Se alternan por CSS según la clase `.dark`, sin JavaScript, para no provocar
 * desajustes de hidratación ni parpadeos al cargar.
 */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/brand/logo-expertic.png"
        alt="ExperTIC"
        width={447}
        height={120}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src="/brand/logo-expertic-oscuro.png"
        alt="ExperTIC"
        width={447}
        height={120}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
