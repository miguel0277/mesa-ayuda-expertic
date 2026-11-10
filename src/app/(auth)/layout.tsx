import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

/**
 * Layout de autenticación: panel de marca (escritorio) + formulario.
 * El panel muestra lo que hace la app (un ticket con su regla de tiempo), no decoración genérica.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0d3f69] text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="auth-pattern absolute inset-0" />
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link
            href="/login"
            className="inline-flex w-fit items-center rounded-lg bg-white px-3 py-2"
          >
            <BrandLogo className="h-9" priority />
          </Link>

          <div className="flex max-w-lg flex-col gap-8">
            <h2 className="text-[2.1rem] leading-[1.15] font-semibold tracking-tight text-balance">
              Cada solicitud con nombre, fecha y responsable.
            </h2>
            <p className="max-w-md text-[1.0625rem] leading-relaxed text-white/80">
              Pide soporte, sigue el estado de lo que pediste y deja de perseguir respuestas por
              correo o WhatsApp.
            </p>

            {/* Muestra: una solicitud real tal como se ve en la app */}
            <div className="w-full max-w-md rounded-xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span className="code-id text-white/90">EXP-2026-00042</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-medium text-white">
                  En progreso
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">La semana 5 no tiene el video de la clase</p>
              <p className="mt-1 text-xs text-white/65">
                Jorge Rangel (profesor), 10/11/2026, 9:12 a. m.
              </p>
              <div className="relative mt-3 h-1.5 rounded-full bg-white/15">
                <div className="auth-rail absolute inset-y-0 left-0 rounded-full bg-[#85be53]" />
                <div className="absolute -top-1 left-[calc(80%-1px)] h-3.5 w-0.5 rounded-full bg-white/80" />
              </div>
              <p className="mt-1.5 text-xs font-medium text-[#b7e08f]">Vence en 18 h</p>
            </div>
          </div>

          <p className="text-sm text-white/60">ExperTIC · Universidad Industrial de Santander</p>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link href="/login" className="lg:invisible" aria-label="Mesa de Ayuda ExperTIC">
            <Image
              src="/brand/isotipo-expertic.png"
              alt=""
              width={128}
              height={128}
              className="size-9"
            />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}
