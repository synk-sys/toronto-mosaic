"use client";

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";

/** Count-up number that animates to new values (respects reduced motion). */
export function LiveCounter({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
}
