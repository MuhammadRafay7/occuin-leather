"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { resetContent, saveContent } from "@/lib/actions/admin-content";
import type { Block } from "@/lib/content/defaults";
import { isSafeInlineHref, splitRich, type TokenName } from "@/lib/content/rich-text";
import { ConfirmButton } from "../../_components/confirm-button";
import { useAction } from "../../_components/controls";
import { buttonClass, controlClass, dangerButtonClass, Empty, ghostButtonClass, linkClass, Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

export type MediaOption = { path: string; filename: string };

export type Form = {
  get: <T>(path: string) => T;
  set: (path: string, next: unknown) => void;
  error: (path: string) => string | undefined;
  errorsUnder: (path: string) => string[];
};

const PREVIEW_LABEL = "See it on the site";

const splitPath = (path: string) => path.split(".").filter(Boolean);

const readPath = (source: unknown, path: string) =>
  splitPath(path).reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], source);

function writePath(source: unknown, [key, ...rest]: string[], next: unknown): unknown {
  if (key === undefined) return next;
  if (Array.isArray(source)) return source.map((item, index) => (String(index) === key ? writePath(item, rest, next) : item));
  const record = source as Record<string, unknown>;
  return { ...record, [key]: writePath(record[key], rest, next) };
}

export function ContentEditor<T>({ contentKey, initial, fallback, previewHref, saveLabel = "Save", children }: { contentKey: string; initial: T; fallback: T; previewHref: string; saveLabel?: string; children: (form: Form) => ReactNode }) {
  const { pending, result, run, clear } = useAction();
  const [value, setValue] = useState<T>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [version, setVersion] = useState(0);
  const errors = useMemo(() => result?.fieldErrors ?? {}, [result]);
  const dirty = JSON.stringify(value) !== baseline;

  const form: Form = {
    get: <V,>(path: string) => readPath(value, path) as V,
    set: (path, next) => setValue((current) => writePath(current, splitPath(path), next) as T),
    error: (path) => errors[path],
    errorsUnder: (path) => Object.entries(errors).filter(([key]) => key.startsWith(`${path}.`)).map(([, message]) => message),
  };

  return (
    <form
      noValidate
      className="adm-stack"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveContent(contentKey, value), (outcome) => {
          if (outcome.ok) setBaseline(JSON.stringify(value));
        });
      }}
    >
      <div key={version} className="adm-stack">{children(form)}</div>
      <div className="adm-card sticky bottom-3 z-10">
        <div className="adm-panel-body flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Saving" : saveLabel}</button>
          <a href={previewHref} target="_blank" rel="noopener noreferrer" className={buttonClass}>{PREVIEW_LABEL}</a>
          <ConfirmButton
            action={() => resetContent(contentKey)}
            prompt="This removes your changes here and brings back the original."
            confirmLabel="Yes, reset"
            onDone={(outcome) => {
              if (!outcome.ok) return;
              clear();
              setValue(fallback);
              setBaseline(JSON.stringify(fallback));
              setVersion((current) => current + 1);
            }}
          >
            Reset to default
          </ConfirmButton>
          <div className="grid gap-0.5">
            {dirty ? <p className="text-xs text-muted">You have changes that are not saved yet.</p> : null}
            <Notice result={result} compact />
          </div>
        </div>
      </div>
    </form>
  );
}

export function Advanced({ form, under = [], label = "Advanced settings", children }: { form: Form; under?: string[]; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const failing = under.some((path) => form.error(path) || form.errorsUnder(path).length);
  return (
    <details className="adm-card" open={open || failing} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="adm-panel-body min-h-11 cursor-pointer text-sm">{label}</summary>
      <div className="adm-panel-body adm-stack">{children}</div>
    </details>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="adm-field min-w-0">
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="adm-field-hint">{hint}</span> : null}
      {error ? <span role="alert" className="adm-field-error">{error}</span> : null}
    </label>
  );
}

type TextProps = { form: Form; path: string; label: string; hint?: ReactNode; rows?: number; placeholder?: string };

export function Text({ form, path, label, hint, rows, placeholder }: TextProps) {
  const value = form.get<string>(path) ?? "";
  const change = (event: { target: { value: string } }) => form.set(path, event.target.value);
  return (
    <Field label={label} hint={hint} error={form.error(path)}>
      {rows ? <textarea rows={rows} value={value} placeholder={placeholder} onChange={change} className={textAreaClass} /> : <input value={value} placeholder={placeholder} onChange={change} className={controlClass} />}
    </Field>
  );
}

export const SITE_PLACES: { group: string; places: { href: string; label: string }[] }[] = [
  {
    group: "Shop",
    places: [
      { href: "/", label: "Home page" },
      { href: "/shop/women", label: "Women" },
      { href: "/shop/men", label: "Men" },
      { href: "/shop/leather", label: "All leather goods" },
      { href: "/shop/leather/laptop-bags", label: "Laptop bags" },
      { href: "/shop/leather/totes", label: "Totes" },
      { href: "/shop/leather/top-handle", label: "Top handle bags" },
      { href: "/shop/leather/crossbody", label: "Crossbody bags" },
      { href: "/shop/leather/travel", label: "Travel bags" },
      { href: "/shop/leather/wallets", label: "Wallets and cards" },
      { href: "/shop/leather/belts", label: "Belts" },
    ],
  },
  {
    group: "Make your own",
    places: [
      { href: "/studio", label: "Customise (3D studio)" },
      { href: "/studio/create", label: "Create your own (designer)" },
    ],
  },
  {
    group: "Help",
    places: [
      { href: "/contact", label: "Contact" },
      { href: "/track", label: "Track an order" },
      { href: "/shipping-returns", label: "Shipping and returns" },
      { href: "/size-guide", label: "Size guide" },
      { href: "/faq", label: "Questions" },
    ],
  },
  {
    group: "About us",
    places: [
      { href: "/about", label: "About" },
      { href: "/care", label: "Leather care" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

const OTHER = "__other";
const CONTACT_PLACES = [
  { href: "mailto:{{email}}", label: "Send us an email" },
  { href: "{{whatsapp_url}}", label: "Chat on WhatsApp" },
];

const knownPlace = (href: string, contact: boolean) =>
  SITE_PLACES.some(({ places }) => places.some((place) => place.href === href)) || (contact && CONTACT_PLACES.some((place) => place.href === href));

function PlaceSelect({ label, value, onChange, error, hint, contact = false }: { label: string; value: string; onChange: (next: string) => void; error?: string; hint?: ReactNode; contact?: boolean }) {
  const [typing, setTyping] = useState(() => Boolean(value) && !knownPlace(value, contact));
  return (
    <div className="grid min-w-0 gap-2">
      <Field label={label} hint={typing ? undefined : hint} error={typing ? undefined : error}>
        <select
          value={typing ? OTHER : value}
          onChange={(event) => {
            const next = event.target.value;
            setTyping(next === OTHER);
            onChange(next === OTHER ? "" : next);
          }}
          className={controlClass}
        >
          {value || typing ? null : <option value="">Pick a page</option>}
          {SITE_PLACES.map(({ group, places }) => (
            <optgroup key={group} label={group}>
              {places.map((place) => <option key={place.href} value={place.href}>{place.label}</option>)}
            </optgroup>
          ))}
          {contact ? <optgroup label="Reach us">{CONTACT_PLACES.map((place) => <option key={place.href} value={place.href}>{place.label}</option>)}</optgroup> : null}
          <option value={OTHER}>Another page or website</option>
        </select>
      </Field>
      {typing ? (
        <Field label="Page or website address" hint="Open the page and copy the address from the top of your browser." error={error}>
          <input value={value} placeholder="https://" onChange={(event) => onChange(event.target.value.trim())} className={controlClass} />
        </Field>
      ) : null}
    </div>
  );
}

export function Place({ form, path, label, hint }: { form: Form; path: string; label: string; hint?: ReactNode }) {
  return <PlaceSelect label={label} hint={hint} value={form.get<string>(path) ?? ""} error={form.error(path)} onChange={(next) => form.set(path, next)} />;
}

const LIVE_DETAILS: { group: string; items: { name: TokenName; label: string }[] }[] = [
  {
    group: "Shipping",
    items: [
      { name: "standard_price", label: "Standard shipping price" },
      { name: "express_price", label: "Express shipping price" },
      { name: "free_shipping_note", label: "Free shipping wording" },
      { name: "standard_label", label: "Standard shipping name" },
      { name: "express_label", label: "Express shipping name" },
    ],
  },
  {
    group: "Timing",
    items: [
      { name: "making_time", label: "Time to make a piece" },
      { name: "standard_arrival", label: "Standard delivery time" },
      { name: "express_arrival", label: "Express delivery time" },
      { name: "making_note", label: "Sentence about making time" },
      { name: "bespoke_note", label: "Sentence about custom pieces" },
    ],
  },
  {
    group: "Your shop",
    items: [
      { name: "brand", label: "Shop name" },
      { name: "email", label: "Support email" },
      { name: "price_from", label: "Lowest product price" },
      { name: "price_to", label: "Highest product price" },
      { name: "countries", label: "Countries we ship to" },
      { name: "country_count", label: "Number of countries" },
      { name: "studio_finishes", label: "Leather types in the studio" },
      { name: "year", label: "This year" },
    ],
  },
];

const DETAIL_NAMES: Partial<Record<TokenName, string>> = { whatsapp_url: "WhatsApp link", ...Object.fromEntries(LIVE_DETAILS.flatMap(({ items }) => items.map((item) => [item.name, item.label]))) };

const LINK_CHIP = "underline underline-offset-2 cursor-pointer";
const VALUE_CHIP = "adm-tag mx-0.5 select-none";

const friendly = (text: string) => splitRich(text).map((part) => (part.kind === "value" ? (DETAIL_NAMES[part.name!] ?? part.label) : part.label)).join("");

function chipNode(raw: string) {
  const [part] = splitRich(raw);
  const node = document.createElement("span");
  node.dataset.raw = raw;
  node.dataset.chip = part!.kind;
  node.contentEditable = "false";
  node.className = part!.kind === "link" ? LINK_CHIP : VALUE_CHIP;
  node.textContent = part!.kind === "value" ? (DETAIL_NAMES[part!.name!] ?? part!.label) : friendly(part!.label);
  return node;
}

function paint(root: HTMLElement, text: string) {
  root.replaceChildren(...splitRich(text).map((part) => (part.kind === "text" ? document.createTextNode(part.raw) : chipNode(part.raw))));
}

function readRaw(node: Node): string {
  return [...node.childNodes]
    .map((child, index) => {
      if (child.nodeType === Node.TEXT_NODE) return child.nodeValue ?? "";
      if (!(child instanceof HTMLElement)) return "";
      if (child.dataset.raw) return child.dataset.raw;
      if (child.tagName === "BR") return "\n";
      return `${child.tagName === "DIV" && index > 0 ? "\n" : ""}${readRaw(child)}`;
    })
    .join("");
}

const hasTypedChips = (root: HTMLElement) => [...root.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && splitRich(child.nodeValue ?? "").some((part) => part.kind !== "text"));

type LinkDraft = { label: string; href: string; locked: boolean; chip: HTMLElement | null };

export function RichText({ form, path, label, hint, rows = 3 }: { form: Form; path: string; label: string; hint?: ReactNode; rows?: number }) {
  const value = form.get<string>(path) ?? "";
  const labelId = useId();
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [panel, setPanel] = useState<"details" | "link" | null>(null);
  const [draft, setDraft] = useState<LinkDraft>({ label: "", href: "", locked: false, chip: null });
  const [linkError, setLinkError] = useState("");
  const error = form.error(path);

  useEffect(() => {
    if (box.current && value !== last.current) {
      paint(box.current, value);
      last.current = value;
    }
  }, [value]);

  useEffect(() => {
    const remember = () => {
      const selection = document.getSelection();
      if (selection?.rangeCount && box.current?.contains(selection.anchorNode)) saved.current = selection.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);

  const commit = () => {
    const next = readRaw(box.current!);
    last.current = next;
    form.set(path, next);
  };

  const place = (raw: string) => {
    const root = box.current!;
    const known = saved.current && root.contains(saved.current.startContainer) ? saved.current : null;
    const range = known ?? (() => {
      const end = document.createRange();
      end.selectNodeContents(root);
      end.collapse(false);
      return end;
    })();
    range.deleteContents();
    const chip = chipNode(raw);
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    saved.current = range;
    root.focus();
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    commit();
  };

  const openLink = () => {
    const words = saved.current && box.current?.contains(saved.current.startContainer) ? saved.current.toString() : "";
    setDraft({ label: words, href: "", locked: false, chip: null });
    setLinkError("");
    setPanel("link");
  };

  const editChip = (chip: HTMLElement) => {
    const [part] = splitRich(chip.dataset.raw!);
    setDraft({ label: part!.label, href: part!.href ?? "", locked: part!.label.includes("{{"), chip });
    setLinkError("");
    setPanel("link");
  };

  const finishLink = () => {
    const words = draft.label.replace(/[[\]\n]/g, " ").trim();
    const probe = draft.href.replaceAll("{{email}}", "a@b.co").replace("{{whatsapp_url}}", "/");
    if (!words) return setLinkError("Please type the words people will see.");
    if (!draft.href) return setLinkError("Please pick where the link goes.");
    if (/[)\s]/.test(draft.href) || !isSafeInlineHref(probe)) return setLinkError("Pick a page from the list, or paste a web address starting with https://.");
    const raw = `[${words}](${draft.href})`;
    if (draft.chip?.isConnected) {
      draft.chip.replaceWith(chipNode(raw));
      commit();
    } else place(raw);
    setPanel(null);
  };

  const removeLink = () => {
    if (draft.chip?.isConnected) {
      draft.chip.replaceWith(document.createTextNode(friendly(draft.label)));
      commit();
    }
    setPanel(null);
  };

  return (
    <div className="adm-field min-w-0">
      <span id={labelId}>{label}</span>
      <div
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        aria-invalid={Boolean(error)}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        style={{ minHeight: `${rows * 1.6 + 1}em`, whiteSpace: "pre-wrap", height: "auto" }}
        className={textAreaClass}
        onInput={commit}
        onClick={(event) => {
          const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-chip="link"]');
          if (chip) editChip(chip);
        }}
        onBlur={() => {
          if (box.current && hasTypedChips(box.current)) paint(box.current, readRaw(box.current));
        }}
      />
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-expanded={panel === "link"} onMouseDown={(event) => event.preventDefault()} onClick={() => (panel === "link" ? setPanel(null) : openLink())} className={ghostButtonClass}>Add link</button>
        <button type="button" aria-expanded={panel === "details"} onMouseDown={(event) => event.preventDefault()} onClick={() => setPanel(panel === "details" ? null : "details")} className={ghostButtonClass}>Add a live detail</button>
      </div>
      {panel === "details" ? (
        <div className="adm-card">
          <div className="adm-panel-body grid gap-3">
            <p className="adm-field-hint">Pick one to drop it in. It updates by itself whenever you change prices or delivery times.</p>
            {LIVE_DETAILS.map(({ group, items }) => (
              <div key={group} className="grid gap-1">
                <p className="text-xs font-medium">{group}</p>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => (
                    <button key={item.name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { place(`{{${item.name}}}`); setPanel(null); }} className={buttonClass}>{item.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {panel === "link" ? (
        <div className="adm-card">
          <div className="adm-panel-body grid gap-3">
            {draft.locked ? (
              <p className="adm-field-hint">This link shows {friendly(draft.label)}.</p>
            ) : (
              <Field label="Words people will see">
                <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={controlClass} />
              </Field>
            )}
            <PlaceSelect key={draft.chip ? draft.chip.dataset.raw : "new"} contact label="Where it goes" value={draft.href} onChange={(href) => setDraft((current) => ({ ...current, href }))} />
            {linkError ? <p role="alert" className="adm-field-error">{linkError}</p> : null}
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={finishLink} className={buttonClass}>{draft.chip ? "Update link" : "Add this link"}</button>
              {draft.chip ? <button type="button" onClick={removeLink} className={dangerButtonClass}>Remove link</button> : null}
              <button type="button" onClick={() => setPanel(null)} className={ghostButtonClass}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      {hint && !error ? <span className="adm-field-hint">{hint}</span> : null}
      {error ? <span role="alert" className="adm-field-error">{error}</span> : null}
    </div>
  );
}

export function Numeric({ form, path, label, hint, scale = 1, step }: { form: Form; path: string; label: string; hint?: ReactNode; scale?: number; step?: string }) {
  const stored = form.get<number | null>(path);
  const [draft, setDraft] = useState(stored === null || stored === undefined ? "" : String(stored / scale));
  return (
    <Field label={label} hint={hint} error={form.error(path)}>
      <input
        inputMode="decimal"
        type="number"
        min="0"
        step={step ?? (scale === 100 ? "0.01" : "any")}
        value={draft}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const parsed = Number(text);
          form.set(path, text.trim() === "" || !Number.isFinite(parsed) ? null : scale === 1 ? parsed : Math.round(parsed * scale));
        }}
        className={controlClass}
      />
    </Field>
  );
}

export function Toggle({ form, path, label }: { form: Form; path: string; label: string }) {
  return (
    <label className="adm-check min-h-11">
      <input type="checkbox" checked={form.get<boolean>(path)} onChange={(event) => form.set(path, event.target.checked)} />
      {label}
    </label>
  );
}

export function Choice({ form, path, label, hint, options }: { form: Form; path: string; label: string; hint?: ReactNode; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} hint={hint} error={form.error(path)}>
      <select value={form.get<string>(path)} onChange={(event) => form.set(path, event.target.value)} className={controlClass}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}

export function ImagePicker({ form, path, label, media }: { form: Form; path: string; label: string; media: MediaOption[] }) {
  const [open, setOpen] = useState(false);
  const value = form.get<string>(path) ?? "";
  const previewable = value.startsWith("/images/") || value.startsWith("/api/media/");
  const name = media.find((item) => item.path === value)?.filename ?? value.split("/").pop();
  const error = form.error(path);
  return (
    <div className="adm-field min-w-0">
      <span>{label}</span>
      <div className="grid grid-cols-[72px_1fr] items-center gap-3">
        <span className="relative block aspect-square overflow-hidden rounded-lg bg-surface">
          {previewable ? <Image unoptimized fill sizes="72px" src={value} alt="" className="object-cover" /> : null}
        </span>
        <div className="grid justify-items-start gap-1">
          <p className="break-all text-xs text-muted">{name}</p>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={buttonClass}>{open ? "Close" : "Choose from the library"}</button>
        </div>
      </div>
      {error ? <span role="alert" className="adm-field-error">{error}</span> : null}
      {open ? (
        media.length ? (
          <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
            {media.map((item) => (
              <li key={item.path}>
                <button type="button" aria-label={`Use ${item.filename}`} aria-pressed={item.path === value} onClick={() => { form.set(path, item.path); setOpen(false); }} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-surface">
                  <Image unoptimized fill sizes="120px" src={item.path} alt={item.filename} className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No pictures yet" body="Add pictures in Media, then come back and choose one." action={<Link href="/admin/media" className={linkClass}>Go to Media</Link>} />
        )
      ) : null}
    </div>
  );
}

export function RowControls({ index, size, onMove, onRemove, label }: { index: number; size: number; onMove: (to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index - 1)} className={ghostButtonClass}>Up</button>
      <button type="button" aria-label={`Move ${label} down`} disabled={index === size - 1} onClick={() => onMove(index + 1)} className={ghostButtonClass}>Down</button>
      <button type="button" aria-label={`Delete ${label}`} onClick={onRemove} className={dangerButtonClass}>Delete</button>
    </div>
  );
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function ListEditor<T>({ form, path, itemLabel, blank, max, emptyBody, addLabel, children }: { form: Form; path: string; itemLabel: string; blank: T; max?: number; emptyBody?: string; addLabel?: string; children: (prefix: string, index: number) => ReactNode }) {
  const items = form.get<T[]>(path) ?? [];
  const full = max !== undefined && items.length >= max;
  const listError = form.error(path);
  return (
    <div className="adm-stack">
      {items.length ? null : <Empty title={`No ${itemLabel}s yet`} body={emptyBody ?? `Add a ${itemLabel} to show it on the site.`} />}
      {items.map((_, index) => (
        <div key={index} className="adm-card">
          <div className="adm-panel-body grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted first-letter:uppercase">{itemLabel} {index + 1}</span>
              <RowControls index={index} size={items.length} label={`${itemLabel} ${index + 1}`} onMove={(to) => form.set(path, move(items, index, to))} onRemove={() => form.set(path, items.filter((__, position) => position !== index))} />
            </div>
            {children(`${path}.${index}`, index)}
          </div>
        </div>
      ))}
      {listError ? <p role="alert" className="adm-field-error">{listError}</p> : null}
      <button type="button" disabled={full} onClick={() => form.set(path, [...items, blank])} className={`${buttonClass} justify-self-start`}>{addLabel ?? `Add ${itemLabel}`}</button>
    </div>
  );
}

function TableEditor({ form, path }: { form: Form; path: string }) {
  const block = form.get<Extract<Block, { type: "table" }>>(path);
  const columns = block.headers.length;
  const setColumns = (headers: string[], rows: string[][]) => form.set(path, { ...block, headers, rows });
  return (
    <div className="grid gap-3">
      <Text form={form} path={`${path}.caption`} label="What this table shows" hint="One short line, read aloud to people who cannot see the table." />
      <div className="overflow-x-auto" role="region" aria-label="Table" tabIndex={0}>
        <div className="grid min-w-[480px] gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr)) auto` }}>
          {block.headers.map((_, column) => <Text key={column} form={form} path={`${path}.headers.${column}`} label={`Column ${column + 1} title`} />)}
          <span />
          {block.rows.flatMap((row, rowIndex) => [
            ...row.map((__, column) => <input key={`${rowIndex}-${column}`} aria-label={`Row ${rowIndex + 1}, column ${column + 1}`} value={row[column] ?? ""} onChange={(event) => form.set(`${path}.rows.${rowIndex}.${column}`, event.target.value)} className={controlClass} />),
            <button key={`${rowIndex}-delete`} type="button" aria-label={`Delete row ${rowIndex + 1}`} onClick={() => form.set(`${path}.rows`, block.rows.filter((__, position) => position !== rowIndex))} className={dangerButtonClass}>Delete</button>,
          ])}
        </div>
      </div>
      {form.errorsUnder(path).map((message) => <p key={message} role="alert" className="adm-field-error">{message}</p>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => form.set(`${path}.rows`, [...block.rows, Array.from({ length: columns }, () => "")])} className={buttonClass}>Add row</button>
        <button type="button" disabled={columns >= 8} onClick={() => setColumns([...block.headers, "New column"], block.rows.map((row) => [...row, ""]))} className={buttonClass}>Add column</button>
        <button type="button" disabled={columns <= 1} onClick={() => setColumns(block.headers.slice(0, -1), block.rows.map((row) => row.slice(0, -1)))} className={ghostButtonClass}>Remove last column</button>
      </div>
    </div>
  );
}

const BLOCK_NAMES: Record<Block["type"], string> = { heading: "Section title", paragraph: "Paragraph", list: "Bullet list", table: "Table" };
const BLANK_BLOCKS: Record<Block["type"], Block> = {
  heading: { type: "heading", text: "" },
  paragraph: { type: "paragraph", text: "" },
  list: { type: "list", items: [""] },
  table: { type: "table", caption: "", headers: ["Column 1", "Column 2"], rows: [["", ""]] },
};

export function BlocksEditor({ form, path, kinds = ["heading", "paragraph", "list", "table"] }: { form: Form; path: string; kinds?: Block["type"][] }) {
  const blocks = form.get<Block[]>(path) ?? [];
  return (
    <div className="adm-stack">
      {blocks.length ? null : <Empty title="Nothing here yet" body="Add a section title, a paragraph or a list below." />}
      {blocks.map((block, index) => {
        const prefix = `${path}.${index}`;
        return (
          <div key={index} className="adm-card">
            <div className="adm-panel-body grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">{BLOCK_NAMES[block.type]}</span>
                <RowControls
                  index={index}
                  size={blocks.length}
                  label={`${BLOCK_NAMES[block.type].toLowerCase()} ${index + 1}`}
                  onMove={(to) => form.set(path, move(blocks, index, to))}
                  onRemove={() => form.set(path, blocks.filter((_, position) => position !== index))}
                />
              </div>
              {block.type === "heading" ? <Text form={form} path={`${prefix}.text`} label="Title" /> : null}
              {block.type === "paragraph" ? <RichText form={form} path={`${prefix}.text`} label="Words" /> : null}
              {block.type === "list" ? (
                <ListEditor form={form} path={`${prefix}.items`} itemLabel="line" blank="" addLabel="Add another line">
                  {(item) => <RichText form={form} path={item} label="Words" rows={2} />}
                </ListEditor>
              ) : null}
              {block.type === "table" ? <TableEditor form={form} path={prefix} /> : null}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <button key={kind} type="button" onClick={() => form.set(path, [...blocks, BLANK_BLOCKS[kind]])} className={buttonClass}>Add {BLOCK_NAMES[kind].toLowerCase()}</button>
        ))}
      </div>
    </div>
  );
}
