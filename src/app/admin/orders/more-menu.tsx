"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export function MoreMenu({ label = "More", children }: { label?: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      const element = menu.current;
      if (!element?.open) return;
      const dismissed = event instanceof KeyboardEvent ? event.key === "Escape" : !element.contains(event.target as Node);
      if (dismissed) element.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const closeAfterLink = (event: MouseEvent) => {
    if ((event.target as Element).closest("a") && menu.current) menu.current.open = false;
  };

  return (
    <details ref={menu} className="group relative shrink-0">
      <summary className="adm-btn list-none [&::-webkit-details-marker]:hidden">
        {label}
        <CaretDown size={12} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div onClick={closeAfterLink} className="adm-menu max-sm:fixed max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-3 max-sm:w-auto sm:absolute sm:top-full sm:right-0 sm:bottom-auto sm:left-auto sm:mt-1 sm:w-60">
        {children}
      </div>
    </details>
  );
}
