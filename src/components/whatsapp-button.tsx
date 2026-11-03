"use client";

import { WhatsappLogo } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { whatsappChatUrl } from "@/lib/bespoke/whatsapp";
import { BRAND } from "@/lib/format";

const HIDDEN_PATHS = ["/checkout", "/orders", "/studio", "/login", "/register", "/forgot", "/reset", "/unsubscribe"];
const REST_GAP = 16;
const CLEARANCE = 10;
const RESCAN_DELAY = 250;

const hiddenOn = (pathname: string) => HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

function pageMessage(pathname: string) {
  const greeting = `Hello ${BRAND.name}, I have a question`;
  if (pathname === "/") return `${greeting} about your pieces.`;
  const url = `${window.location.origin}${pathname}`;
  const heading = document.querySelector("main h1")?.textContent?.replace(/\s+/g, " ").trim();
  const title = document.title.replace(new RegExp(`\\s*[|·-]\\s*${BRAND.name}\\s*$`, "i"), "").trim();
  if (pathname.startsWith("/product/")) return `${greeting} about the ${heading || title}. ${url}`;
  return `${greeting}. I am looking at ${title || heading || "your site"}: ${url}`;
}

function floatingObstacles(self: HTMLElement) {
  const found: HTMLElement[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node === self || node.nodeName === "DIALOG" || node.nodeName === "SCRIPT" || node.nodeName === "svg") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node as HTMLElement;
    const style = getComputedStyle(element);
    if (element.hasAttribute("data-float-avoid")) {
      found.push(element);
      continue;
    }
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    if (style.position === "sticky" && style.bottom === "auto") continue;
    found.push(element);
  }
  return found;
}

function visibleBoxes(obstacles: HTMLElement[]) {
  return obstacles.flatMap((element) => {
    if (!element.isConnected || element.closest("[inert]")) return [];
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.1) return [];
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height || box.top >= window.innerHeight || box.top <= window.innerHeight / 3) return [];
    return [box];
  });
}

function liftFor(obstacles: HTMLElement[], rest: DOMRect) {
  const boxes = visibleBoxes(obstacles);
  let lift = 0;
  for (let pass = 0; pass <= boxes.length; pass += 1) {
    const top = rest.top - lift;
    const bottom = rest.bottom - lift;
    const blocking = boxes.filter((box) => box.left < rest.right && box.right > rest.left && box.top < bottom + CLEARANCE && box.bottom > top - CLEARANCE);
    if (!blocking.length) break;
    lift = Math.max(lift, ...blocking.map((box) => rest.bottom - box.top + CLEARANCE));
  }
  return lift;
}

export function WhatsAppButton({ number }: { number: string }) {
  const pathname = usePathname();
  const anchor = useRef<HTMLAnchorElement>(null);
  const [lift, setLift] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const hidden = hiddenOn(pathname);

  useEffect(() => {
    const node = anchor.current;
    if (hidden || !node) return;
    let obstacles: HTMLElement[] = [];
    let frame = 0;
    let scanTimer = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const size = node.offsetWidth;
        const right = window.innerWidth - REST_GAP;
        const bottom = window.innerHeight - REST_GAP;
        const rest = new DOMRect(right - size, bottom - node.offsetHeight, size, node.offsetHeight);
        const next = liftFor(obstacles, rest);
        const tooHigh = next > window.innerHeight * 0.45;
        setBlocked(tooHigh);
        setLift(tooHigh ? 0 : Math.round(next));
      });
    };
    const scan = () => {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        obstacles = floatingObstacles(node);
        measure();
      }, RESCAN_DELAY);
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    const settle = window.setInterval(measure, 400);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", scan);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(scanTimer);
      window.clearInterval(settle);
      mutations.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", scan);
    };
  }, [hidden, pathname]);

  if (hidden) return null;

  function prepare(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = whatsappChatUrl(number, pageMessage(pathname));
  }

  return (
    <a
      ref={anchor}
      href={whatsappChatUrl(number, `Hello ${BRAND.name}, I have a question.`)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={prepare}
      onAuxClick={prepare}
      onContextMenu={prepare}
      aria-label="Ask us on WhatsApp, opens WhatsApp"
      inert={blocked}
      style={{ transform: `translateY(${-lift}px)`, opacity: blocked ? 0 : undefined }}
      className="glass-panel fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-[21] flex size-[52px] items-center justify-center gap-2 rounded-full text-[13px] font-medium text-fg transition-[transform,opacity] duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.96] md:h-12 md:w-auto md:pl-3.5 md:pr-5"
    >
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-invert-bg text-invert-fg">
        <WhatsappLogo size={18} weight="fill" />
      </span>
      <span className="hidden md:inline">Ask us on WhatsApp</span>
    </a>
  );
}
