"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 520;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTween(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const shown = useRef(target);

  useEffect(() => {
    if (shown.current === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = target;
      setValue(target);
      return;
    }
    from.current = shown.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      shown.current = from.current + (target - from.current) * ease(progress);
      setValue(shown.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
