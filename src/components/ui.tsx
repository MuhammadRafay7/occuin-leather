import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const BUTTON_BASE =
  "inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full px-7 text-sm font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
const BUTTON_STYLES = {
  solid: "bg-invert-bg text-invert-fg hover:opacity-85",
  outline: "border border-fg text-fg hover:bg-invert-bg hover:text-invert-fg",
  quiet: "text-fg underline underline-offset-4 hover:opacity-60",
};
type Style = keyof typeof BUTTON_STYLES;

export const buttonClass = (style: Style = "solid", extra = "") => `${BUTTON_BASE} ${BUTTON_STYLES[style]} ${extra}`;

export function Button({ look = "solid", className = "", ...props }: ComponentProps<"button"> & { look?: Style }) {
  return <button className={buttonClass(look, className)} {...props} />;
}

export function LinkButton({ look = "solid", className = "", ...props }: ComponentProps<typeof Link> & { look?: Style }) {
  return <Link className={buttonClass(look, className)} {...props} />;
}

export const inputClass =
  "h-12 w-full border border-line bg-transparent px-3 text-[15px] text-fg placeholder:text-muted focus:border-fg focus:outline-none";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="text-xs text-muted">{hint}</span> : null}
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.01em] text-invert-bg md:text-7xl">{children}</h1>
      {sub ? <p className="mt-3 max-w-[60ch] text-muted">{sub}</p> : null}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-4 py-20">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="max-w-[50ch] text-muted">{body}</p>
      {action}
    </div>
  );
}
