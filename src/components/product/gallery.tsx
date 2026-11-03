"use client";

import { Cube, Image as ImageIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRef, useState, type UIEvent } from "react";
import { LensFrame, type ZoomImage } from "@/components/glass/liquid-lens";
import { ZoomViewer } from "@/components/glass/zoom-viewer";
import type { DesignSpec } from "@/lib/studio/spec";

const FRAME_SIZES = "(min-width: 1024px) 760px, 100vw";
const TALLEST = 3 / 4;
const WIDEST = 1;

const loadModel = () => import("@/components/product/model-view");
const ModelView = dynamic(() => loadModel().then((module) => module.ModelView), { ssr: false, loading: () => <Shaping /> });

function Shaping() {
  return (
    <p role="status" className="absolute inset-0 grid place-items-center text-[13px]">
      <span className="glass-panel rounded-full px-4 py-2">Shaping the leather</span>
    </p>
  );
}

const frameRatio = ({ width, height }: ZoomImage) => Math.min(Math.max(width / height, TALLEST), WIDEST);

export type GalleryModel = { spec: DesignSpec; slug: string; name: string; initialsPrice: string };

const SWITCH = "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors aria-pressed:bg-invert-bg aria-pressed:text-invert-fg hover:bg-white/60 aria-pressed:hover:bg-invert-bg";

export function Gallery({ images, model }: { images: ZoomImage[]; model?: GalleryModel | null }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [inThreeD, setInThreeD] = useState(false);
  const [modelShown, setModelShown] = useState(false);
  const rail = useRef<HTMLDivElement>(null);

  function track(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    if (node.clientWidth) setCurrent(Math.round(node.scrollLeft / node.clientWidth));
  }

  const warm = () => void loadModel().then((module) => module.loadScene());

  return (
    <div className={`glass relative mx-2 rounded-[32px] !bg-white/20 lg:mx-0 lg:h-full ${inThreeD ? "max-lg:min-h-[min(132vw,560px)] short:min-h-[calc(100svh-12px)]" : ""}`}>
      <div
        ref={rail}
        onScroll={track}
        inert={inThreeD}
        aria-hidden={inThreeD || undefined}
        className={`flex snap-x snap-mandatory overflow-x-auto transition-opacity duration-300 [scrollbar-width:none] lg:block lg:h-full lg:overflow-visible ${inThreeD && modelShown ? "opacity-0" : "opacity-100"}`}
      >
        {images.map((image, index) => (
          <LensFrame key={image.src} image={image} priority={index === 0} ratio={frameRatio(image)} sizes={FRAME_SIZES} onOpen={() => setViewing(index)} />
        ))}
      </div>
      {images.length > 1 && !inThreeD ? (
        <div aria-hidden className="glass-panel pointer-events-none absolute bottom-3 right-3 flex h-9 items-center gap-1.5 rounded-full px-3 lg:hidden">
          {images.map((image, index) => (
            <span key={image.src} className={`size-1.5 rounded-full transition-colors ${index === current ? "bg-fg" : "bg-fg/30"}`} />
          ))}
        </div>
      ) : null}
      {model ? (
        <>
          {inThreeD ? (
            <section aria-label={`${model.name} in 3D`} className="absolute inset-0 z-10 overflow-hidden rounded-[32px]">
              <ModelView spec={model.spec} slug={model.slug} name={model.name} initialsPrice={model.initialsPrice} onReady={() => setModelShown(true)} onBack={() => setInThreeD(false)} />
            </section>
          ) : null}
          <div role="group" aria-label="Show the piece as" className="glass-panel absolute left-3 top-3 z-20 flex gap-0.5 rounded-full p-1">
            <button type="button" aria-pressed={!inThreeD} onClick={() => {
                setInThreeD(false);
                setModelShown(false);
              }} className={SWITCH}>
              <ImageIcon size={15} aria-hidden />
              {images.length > 1 ? "Photos" : "Photo"}
            </button>
            <button type="button" aria-pressed={inThreeD} onPointerEnter={warm} onFocus={warm} onClick={() => setInThreeD(true)} className={SWITCH}>
              <Cube size={15} aria-hidden />
              3D
            </button>
          </div>
        </>
      ) : null}
      {viewing === null ? null : <ZoomViewer images={images} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
