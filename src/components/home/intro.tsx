"use client";

import { useEffect, useState } from "react";

const WRITING_MS = 4200;
const REDUCED_MS = 300;
const LONGEST_MS = 8000;
const LEAVING_MS = 1000;
const WELCOME =
  "M20 90C30 130 34 170 52 178C70 184 86 130 92 104C96 140 104 178 124 178C146 176 160 130 166 96C170 130 184 150 206 146C232 140 254 122 252 104C250 88 218 92 208 126C200 156 216 184 248 180C274 176 296 150 312 116C330 78 348 44 342 22C336 4 310 18 304 58C298 100 292 150 304 172C314 190 340 176 356 152C372 130 396 104 414 112C424 118 418 128 412 122C400 104 366 124 362 156C360 182 392 190 420 172C436 160 446 144 456 132C468 116 490 108 506 116C530 128 524 170 498 182C474 190 454 172 460 146C466 120 496 108 520 120C530 125 540 124 552 118C566 110 576 106 574 130C572 150 566 168 564 180C574 150 592 110 612 112C626 116 616 150 610 180C622 146 642 110 662 112C678 116 662 156 666 172C672 190 700 178 716 156C736 140 760 122 758 104C756 88 724 92 714 126C706 156 722 184 754 180C782 176 810 156 826 130";

export function Intro({ ready }: { ready: boolean }) {
  const [shown, setShown] = useState(() => typeof document === "undefined" || Boolean(document.querySelector(".intro")));
  const [written, setWritten] = useState(false);
  const [expired, setExpired] = useState(false);
  const leaving = shown && ((ready && written) || expired);

  useEffect(() => {
    if (!shown) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const writing = window.setTimeout(() => setWritten(true), reduced ? REDUCED_MS : WRITING_MS);
    const longest = window.setTimeout(() => setExpired(true), LONGEST_MS);
    return () => {
      window.clearTimeout(writing);
      window.clearTimeout(longest);
    };
  }, [shown]);

  useEffect(() => {
    if (!leaving) return;
    const leave = window.setTimeout(() => setShown(false), LEAVING_MS);
    return () => window.clearTimeout(leave);
  }, [leaving]);

  if (!shown) return null;
  return (
    <div aria-hidden className={`intro ${leaving ? "intro-leaving" : ""}`}>
      <svg viewBox="0 0 846 200" className="intro-word">
        <defs>
          <linearGradient id="intro-sheen" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f4efe6" />
            <stop offset="0.5" stopColor="#ffffff" />
            <stop offset="1" stopColor="#cfe0d6" />
          </linearGradient>
        </defs>
        <path pathLength={1} d={WELCOME} stroke="url(#intro-sheen)" />
      </svg>
    </div>
  );
}
