"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export const APPLE_EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Número que cuenta hasta su valor cuando entra en pantalla y se anima suavemente
 * en cada cambio. Escribe directamente en el DOM (sin re-render por fotograma).
 * El HTML del servidor ya trae el valor final, así que no hay desajuste de hidratación.
 */
export function AnimatedNumber({ value, format, className, duration = 1.2 }: { value: number; format: (n: number) => string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const from = current.current ?? 0;
    current.current = value;
    if (reduced || from === value) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(from, value, {
      duration: from === 0 ? duration : 0.6,
      ease: APPLE_EASE,
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, inView, reduced, format, duration]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
