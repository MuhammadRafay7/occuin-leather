"use client";

import type { DEFAULT_REDIRECTS } from "@/lib/content/defaults";
import { linkClass } from "../../_components/ui";
import { Advanced, ContentEditor, Field, ListEditor, Place, Toggle, type Form } from "../_components/editor";

const BLANK = { source: "", destination: "", permanent: true, enabled: true };
const OWN_SITE = /^(?:https?:\/\/)?(?:www\.)?(?:occuin\.com|localhost(?::\d+)?)(?=\/|$)/i;

function OldPage({ form, path }: { form: Form; path: string }) {
  return (
    <Field label="Send people from this page" hint="Paste the old address, such as /old-page." error={form.error(path)}>
      <input
        value={form.get<string>(path) ?? ""}
        placeholder="/old-page"
        onChange={(event) => form.set(path, event.target.value.trim().replace(OWN_SITE, ""))}
        className="adm-control"
      />
    </Field>
  );
}

export function RedirectsEditor({ initial, fallback }: { initial: typeof DEFAULT_REDIRECTS; fallback: typeof DEFAULT_REDIRECTS }) {
  return (
    <ContentEditor contentKey="redirects" initial={initial} fallback={fallback} previewHref={initial.rules[0]?.source ?? "/"}>
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <ListEditor form={form} path="rules" itemLabel="old link" blank={BLANK} max={500} addLabel="Send people from one page to another" emptyBody="Add one when a page moves, so old links keep working.">
            {(prefix) => {
              const source = form.get<string>(`${prefix}.source`);
              return (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <OldPage form={form} path={`${prefix}.source`} />
                    <Place form={form} path={`${prefix}.destination`} label="To this page" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5">
                    <Toggle form={form} path={`${prefix}.enabled`} label="Turned on" />
                    {source.startsWith("/") ? <a href={source} target="_blank" rel="noopener noreferrer" className={`text-xs ${linkClass}`}>Try it</a> : null}
                  </div>
                  <Advanced form={form} label="More options">
                    <Toggle form={form} path={`${prefix}.permanent`} label="This page has moved for good" />
                    <p className="adm-field-hint">Leave this ticked unless the old page is coming back. Ticked tells Google to use the new page.</p>
                  </Advanced>
                </>
              );
            }}
          </ListEditor>
        </div>
      )}
    </ContentEditor>
  );
}
