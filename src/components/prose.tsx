import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line pt-6 md:grid-cols-[1fr_2fr] md:gap-8">
      {title ? <h2 className="font-display text-2xl leading-tight">{title}</h2> : <span />}
      <div className="grid max-w-[65ch] gap-3 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-4 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">{children}</div>
    </section>
  );
}

export function Sections({ children }: { children: ReactNode }) {
  return <div className="grid gap-10">{children}</div>;
}

export function PageNotice({ children }: { children: ReactNode }) {
  return <p className="mb-10 border border-fg p-4 text-sm [&_a]:underline [&_a]:underline-offset-4">{children}</p>;
}
