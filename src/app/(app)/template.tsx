/**
 * Transición de página (sección 8): fundido + 8 px, 220 ms, ease-out.
 *
 * Es CSS (tw-animate-css) y no Motion a propósito: con Motion el HTML del servidor sale con
 * opacity: 0 y el contenido queda invisible hasta hidratar (peor LCP). Con CSS la animación
 * corre de inmediato. `template` se vuelve a montar en cada navegación, así que se repite.
 * Con prefers-reduced-motion la regla global de globals.css la anula.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 animate-in flex-col duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] fade-in slide-in-from-bottom-2">
      {children}
    </div>
  );
}
