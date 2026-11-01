"use client";

import { useRef, useState, type UIEvent } from "react";
import { LensFrame, type ZoomImage } from "@/components/glass/liquid-lens";
import { ZoomViewer } from "@/components/glass/zoom-viewer";

const FRAME_SIZES = "(min-width: 1024px) 760px, 100vw";
const TALLEST = 3 / 4;
const WIDEST = 1;

const frameRatio = ({ width, height }: ZoomImage) => Math.min(Math.max(width / height, TALLEST), WIDEST);

export function Gallery({ images }: { images: ZoomImage[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const rail = useRef<HTMLDivElement>(null);

  function track(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    if (node.clientWidth) setCurrent(Math.round(node.scrollLeft / node.clientWidth));
  }

  return (
    <div className="relative lg:z-10 lg:bg-surface">
      <div
        ref={rail}
        onScroll={track}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] lg:grid lg:justify-items-center lg:gap-1 lg:overflow-visible"
      >
        {images.map((image, index) => (
          <LensFrame key={image.src} image={image} priority={index === 0} ratio={frameRatio(image)} sizes={FRAME_SIZES} onOpen={() => setViewing(index)} />
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden className="glass-panel pointer-events-none absolute bottom-3 right-3 flex h-9 items-center gap-1.5 rounded-full px-3 lg:hidden">
          {images.map((image, index) => (
            <span key={image.src} className={`size-1.5 rounded-full transition-colors ${index === current ? "bg-fg" : "bg-fg/30"}`} />
          ))}
        </div>
      ) : null}
      {viewing === null ? null : <ZoomViewer images={images} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
