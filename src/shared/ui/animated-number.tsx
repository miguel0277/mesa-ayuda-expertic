"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { duration, ease } from "./motion";

/**
 * Contador animado para KPIs (sección 8). El HTML del servidor trae el valor final
 * (nunca un número falso); al entrar en pantalla cuenta desde 0 una sola vez.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    if (!inView || reduce || done.current) return;
    done.current = true;
    const controls = animate(0, value, {
      duration: duration.count,
      ease: ease.out,
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  const text = shown.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {text}
        {suffix}
      </span>
      <span className="sr-only">
        {value.toLocaleString("es-CO", { maximumFractionDigits: decimals })}
        {suffix}
      </span>
    </span>
  );
}
