"use client";

import { useEffect, useRef, useState } from "react";

/** Retarget from the current frame so reversing a scroll never restarts from old bounds. */
export function useAnimatedChartDomain(target: [number, number]): [number, number] {
  const [domain, setDomain] = useState<[number, number]>(target);
  const current = useRef(domain);
  const [lower, upper] = target;

  useEffect(() => {
    const destination: [number, number] = [lower, upper];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = destination;
      setDomain(destination);
      return;
    }
    const start = current.current;
    if (start[0] === lower && start[1] === upper) return;
    let frame: number;
    let startedAt: number | null = null;
    const animate = (time: number) => {
      startedAt ??= time;
      const progress = Math.min(1, (time - startedAt) / 260);
      const eased = 1 - (1 - progress) ** 3;
      const next: [number, number] = progress === 1 ? destination : [
        start[0] + (lower - start[0]) * eased,
        start[1] + (upper - start[1]) * eased,
      ];
      current.current = next;
      setDomain(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [lower, upper]);

  return domain;
}
