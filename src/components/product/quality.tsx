import Image from "next/image";

const MACROS = [
  { src: "/images/hero/macro-grain.webp", alt: "Close-up of full-grain leather surface", label: "Grain" },
];

const POINTS = [
  { title: "Full-grain leather", body: "The top layer of the hide, kept whole. The natural grain stays visible and the surface softens and darkens with use." },
  { title: "Hand stitching", body: "Seams are sewn by hand in Pakistan. You can see the line of each stitch up close." },
  { title: "Solid metal fittings", body: "Buckles and hardware are solid metal, made to carry weight and wear in with the leather." },
];

export function Quality() {
  const macros = MACROS;

  return (
    <section aria-labelledby="quality" className="mt-14 border-t border-line pt-8">
      <h2 id="quality" className="font-display text-xl">Quality</h2>
      <div className={`mt-4 grid gap-8 ${macros.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        {macros.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {macros.map((macro) => (
              <figure key={macro.src} className="relative aspect-[16/9] overflow-hidden bg-surface lg:aspect-[4/3]">
                <Image src={macro.src} alt={macro.alt} fill sizes="(min-width: 1024px) 300px, 100vw" className="object-cover" />
                <figcaption className="glass-panel absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-xs text-fg">{macro.label}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        <dl className={`grid gap-5 ${macros.length ? "" : "md:grid-cols-3"}`}>
          {POINTS.map((point) => (
            <div key={point.title}>
              <dt className="text-[13px] font-medium">{point.title}</dt>
              <dd className="mt-1 max-w-[46ch] text-[13px] leading-[1.5] text-muted lg:text-[12px]">{point.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
