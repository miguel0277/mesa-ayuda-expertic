import type { Transition, Variants } from "motion/react";

/**
 * Presets de movimiento centralizados (sección 8 del prompt).
 * Principio: el movimiento responde a una acción o señala un cambio; no decora.
 * `MotionConfig reducedMotion="user"` (en Providers) los desactiva con prefers-reduced-motion.
 */

export const duration = {
  instant: 0.1,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  /** Contadores de KPI y barras que crecen. */
  count: 0.9,
} as const;

/** Curvas: salida suave (ease-out) para entradas, más corta para salidas. */
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.45, 0, 0.55, 1],
  in: [0.4, 0, 1, 1],
} as const;

export const spring = {
  /** Soltar una tarjeta en el Kanban. */
  drop: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  /** Reordenamientos de layout. */
  layout: { type: "spring", stiffness: 380, damping: 36 },
  /** Microinteracciones (press, toggles). */
  snappy: { type: "spring", stiffness: 700, damping: 40 },
} as const satisfies Record<string, Transition>;

/** Transición de página: fade + 8 px, 220 ms, ease-out. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.in } },
};

/** Contenedor con entrada escalonada (KPIs, filas de lista). */
export const staggerContainer = (stagger = 0.04, delayChildren = 0.02): Variants => ({
  initial: {},
  enter: { transition: { staggerChildren: stagger, delayChildren } },
});

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  enter: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
};

/** Press de botones y tarjetas interactivas. */
export const press = { scale: 0.98 } as const;

/** Pulso del badge de notificaciones nuevas (una vez, no en bucle infinito). */
export const pulseOnce: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.18, 1],
    transition: { duration: 0.5, ease: ease.out },
  },
};
