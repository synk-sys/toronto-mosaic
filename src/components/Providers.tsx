"use client";

import { MotionConfig } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Respect the OS "reduce motion" preference for every Motion animation.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
