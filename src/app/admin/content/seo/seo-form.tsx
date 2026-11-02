"use client";

import { useState } from "react";
import type { DEFAULT_SEO } from "@/lib/content/defaults";
import { fillTokens, type TokenValues } from "@/lib/content/rich-text";
import { absoluteUrl } from "@/lib/seo";
import { controlClass, Empty, Section, Tag, textAreaClass } from "../../_components/ui";
import { Advanced, ContentEditor, Field, ImagePicker, RichText, Text, type Form, type MediaOption } from "../_components/editor";

export type SeoRow = { path: string; group: string; title: string; description: string };

const TITLE_RANGE = { min: 50, max: 60 };
const DESCRIPTION_RANGE = { min: 120, max: 155 };

function Counter({ text, range }: { text: string; range: { min: number; max: number } }) {
  const outside = text.length < range.min || text.length > range.max;
  return <span className={outside ? "text-danger" : ""}>{text.length} characters. Google shows about {range.min} to {range.max}.</span>;
}

function SearchPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="adm-card" aria-label="How this looks in Google">
      <div className="adm-panel-body">
        <p className="adm-field-hint">How it looks in Google</p>
        <p className="truncate text-xs text-muted">{url}</p>
        <p className="truncate text-base">{title}</p>
        <p className="line-clamp-2 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function OverrideRow({ form, row, tokens }: { form: Form; row: SeoRow; tokens: TokenValues }) {
  const pages = form.get<Record<string, { title: string; description: string }>>("pages");
  const current = pages[row.path];
  const title = current?.title ?? "";
  const description = current?.description ?? "";
  const update = (patch: Partial<{ title: string; description: string }>) => {
    const next = { title, description, ...patch };
    const { [row.path]: _, ...others } = pages;
    form.set("pages", next.title || next.description ? { ...others, [row.path]: next } : others);
  };
  const shownTitle = fillTokens(title || row.title, tokens);
  const shownDescription = fillTokens(description || row.description, tokens);
  const failing = Boolean(form.error(`pages.${row.path}.title`) || form.error(`pages.${row.path}.description`));
  return (
    <details className="adm-card" open={failing || undefined}>
      <summary className="adm-panel-body flex min-h-11 cursor-pointer flex-wrap items-center gap-2 text-sm">
        <span className="min-w-0 flex-1">{shownTitle}<span className="block break-all text-xs text-muted">{row.path}</span></span>
        {current ? <Tag>Changed</Tag> : null}
      </summary>
      <div className="adm-panel-body grid gap-3">
        <Field label="Title in Google" hint={<Counter text={shownTitle} range={TITLE_RANGE} />} error={form.error(`pages.${row.path}.title`)}>
          <input value={title} placeholder={row.title} onChange={(event) => update({ title: event.target.value })} className={controlClass} />
        </Field>
        <Field label="Description in Google" hint={<Counter text={shownDescription} range={DESCRIPTION_RANGE} />} error={form.error(`pages.${row.path}.description`)}>
          <textarea rows={3} value={description} placeholder={row.description} onChange={(event) => update({ description: event.target.value })} className={textAreaClass} />
        </Field>
        <SearchPreview title={shownTitle} url={absoluteUrl(row.path)} description={shownDescription} />
      </div>
    </details>
  );
}

function PageRows({ form, rows, tokens }: { form: Form; rows: SeoRow[]; tokens: TokenValues }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? rows.filter((row) => `${row.path} ${row.title}`.toLowerCase().includes(needle)) : rows;
  const groups = [...new Set(rows.map((row) => row.group))];
  return (
    <div className="adm-stack">
      <label className="adm-field max-w-sm">
        <span>Find a page</span>
        <input type="search" value={query} placeholder="Try belts or about" onChange={(event) => setQuery(event.target.value)} className={controlClass} />
      </label>
      {shown.length ? null : <Empty title="No pages found" body="Try another word." />}
      {groups.map((group) => {
        const list = shown.filter((row) => row.group === group);
        return list.length ? (
          <div key={group} className="grid gap-1">
            <h3 className="text-xs font-medium">{group}</h3>
            {list.map((row) => <OverrideRow key={row.path} form={form} row={row} tokens={tokens} />)}
          </div>
        ) : null;
      })}
    </div>
  );
}

export function SeoEditor({ initial, fallback, rows, tokens, media }: { initial: typeof DEFAULT_SEO; fallback: typeof DEFAULT_SEO; rows: SeoRow[]; tokens: TokenValues; media: MediaOption[] }) {
  return (
    <ContentEditor contentKey="seo" initial={initial} fallback={fallback} previewHref="/">
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Section title="When someone shares a link" description="The picture shown on WhatsApp, Facebook and similar.">
            <div className="adm-stack">
              <ImagePicker form={form} path="ogImage" label="Sharing picture" media={media} />
              <Text form={form} path="ogImageAlt" label="Describe the picture" />
            </div>
          </Section>
          <Section title="Each page in Google" description="Open a page to change it. Leave a box empty to keep our suggested words.">
            <PageRows form={form} rows={rows} tokens={tokens} />
          </Section>
          <Advanced form={form} under={["siteTitle", "siteDescription", "organizationDescription", "llms"]}>
            <Text form={form} path="siteTitle" label="Title for pages that have none" />
            <Text form={form} path="siteDescription" label="Description for pages that have none" rows={2} />
            <Text form={form} path="organizationDescription" label="One line about your business for Google" rows={2} />
            <RichText form={form} path="llms" label="Notes for AI assistants" hint="AI tools such as ChatGPT read this to learn about your shop." rows={14} />
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}
