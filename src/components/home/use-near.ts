"use client";

import { useEffect, useState, type RefObject } from "react";

export function useNear(target: RefObject<HTMLElement | null>, margin = "100% 0px") {
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const node = target.current;
    if (!node) return;
    let inside = false;
    const approach = new IntersectionObserver(([entry]) => {
      const now = Boolean(entry?.isIntersecting);
      if (now && !inside) setSession((value) => value + 1);
      inside = now;
      setNear(now);
    }, { rootMargin: margin });
    const view = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)));
    approach.observe(node);
    view.observe(node);
    return () => {
      approach.disconnect();
      view.disconnect();
    };
  }, [target, margin]);

  return { near, visible, session };
}
