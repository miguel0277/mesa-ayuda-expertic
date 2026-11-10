import { Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/components/empty";
import { Skeleton } from "@/shared/ui/components/skeleton";
import { ForbiddenIllustration, NotFoundIllustration } from "./illustrations";

/**
 * Estados de vista reutilizables (sección 8): encabezado, vacío, sin permiso, no encontrado
 * y esqueletos de carga con la forma real. El estado de error con "Reintentar" está en
 * error-state.tsx (necesita ser de cliente).
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("flex-none rounded-xl border bg-card py-14", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

function CenteredMessage({
  illustration,
  title,
  description,
  children,
}: {
  illustration: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {illustration}
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ForbiddenView() {
  return (
    <CenteredMessage
      illustration={<ForbiddenIllustration className="h-32 w-auto" />}
      title="Esta sección no está disponible para tu rol"
      description="Si crees que deberías tener acceso, pídele al docente ExperTIC o al administrador que revise tu rol."
    >
      <Button asChild>
        <Link href="/inicio">Ir a mi inicio</Link>
      </Button>
    </CenteredMessage>
  );
}

export function NotFoundView() {
  return (
    <CenteredMessage
      illustration={<NotFoundIllustration className="h-32 w-auto" />}
      title="No encontramos esta página"
      description="Puede que el enlace esté mal escrito o que la página ya no exista. Si buscas un ticket, usa la búsqueda con Ctrl K."
    >
      <Button asChild>
        <Link href="/inicio">Ir a mi inicio</Link>
      </Button>
    </CenteredMessage>
  );
}

/** Esqueleto de página: encabezado + banda de indicadores + lista, con la silueta real. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 bg-card p-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

/** Esqueleto de lista: ícono + código + título + regla de tiempo. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y rounded-xl border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 p-4">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-1.5 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
