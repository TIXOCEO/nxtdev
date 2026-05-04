"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /**
   * `y` (default) → fade + slide omhoog
   * `up` → langere slide
   * `none` → alleen fade-in
   */
  variant?: "y" | "up" | "none";
}

/**
 * Lichte fade-in / slide-up animatie. We gebruiken `whileInView` met een
 * lage drempel én vallen terug op `animate` zodat content altijd zichtbaar
 * wordt — ook wanneer de IntersectionObserver-detectie een trigger mist.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
  variant = "y",
}: ScrollRevealProps) {
  const shouldReduce = useReducedMotion();
  const offset = variant === "up" ? 24 : variant === "none" ? 0 : 12;

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
