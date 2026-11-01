"use client";

import { useEffect, useRef, type ComponentProps } from "react";

export function ScrollRail({ className = "", children, ...props }: ComponentProps<"nav">) {
  const rail = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = rail.current;
    const current = node?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!node || !current) return;
    node.scrollLeft = current.offsetLeft - (node.clientWidth - current.offsetWidth) / 2;
  }, []);

  return (
    <nav ref={rail} {...props} className={`flex gap-6 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </nav>
  );
}
