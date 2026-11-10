import Image from "next/image";

/** Página provisional de la Fase 1. El diseño real llega en la Fase 2. */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Image
        src="/brand/logo-expertic.png"
        alt="ExperTIC"
        width={447}
        height={120}
        priority
        className="h-auto w-64"
      />
      <h1 className="text-2xl font-semibold">Mesa de Ayuda ExperTIC</h1>
      <p className="max-w-md text-balance opacity-70">
        Estamos construyendo la plataforma. Revisa el estado del sistema en{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
        .
      </p>
    </main>
  );
}
