"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((node) => node.offsetParent !== null && !node.closest("[inert]"));
    focusable()[0]?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus({ preventScroll: true });
    };
  }, [ref, active, onEscape]);
}

export function useScrollLock(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const block = (event: Event) => {
      const scroller = (event.target as HTMLElement).closest<HTMLElement>("[data-scroll]");
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) event.preventDefault();
    };
    root.addEventListener("wheel", block, { passive: false });
    root.addEventListener("touchmove", block, { passive: false });
    return () => {
      root.removeEventListener("wheel", block);
      root.removeEventListener("touchmove", block);
    };
  }, [ref, active]);
}

export function useFloatingClearance(ref: RefObject<HTMLElement | null>) {
  const [nearFooter, setNearFooter] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const measure = () => {
      const notice = document.querySelector('[aria-label="Cookie notice"]')?.getBoundingClientRect();
      const box = ref.current?.getBoundingClientRect();
      const overlaps = notice && box && notice.left < box.right && notice.right > box.left;
      setLift(overlaps ? Math.max(window.innerHeight - notice.top, 0) : 0);
    };
    measure();

    let footerInView = false;
    const update = () => setNearFooter(footerInView && window.scrollY > 0);
    const intersection = new IntersectionObserver(
      ([entry]) => {
        footerInView = Boolean(entry?.isIntersecting);
        update();
      },
      { rootMargin: "0px 0px 24px 0px" },
    );
    intersection.observe(footer);
    window.addEventListener("scroll", update, { passive: true });
    const mutation = new MutationObserver(measure);
    mutation.observe(footer, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      intersection.disconnect();
      mutation.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return { nearFooter, lift };
}
