"use client";

import type { DEFAULT_NAV, LinkItem } from "@/lib/content/defaults";
import { Section } from "../../_components/ui";
import { Advanced, Choice, ContentEditor, ListEditor, Place, Text, type Form } from "../_components/editor";

const MENUS = [
  { value: "none", label: "No menu" },
  { value: "women", label: "Women's categories, kept up to date for you" },
  { value: "men", label: "Men's categories, kept up to date for you" },
  { value: "custom", label: "My own list of links" },
];

const BLANK_LINK: LinkItem = { label: "", href: "/" };

function LinkFields({ form, prefix }: { form: Form; prefix: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Text form={form} path={`${prefix}.label`} label="Words people see" />
      <Place form={form} path={`${prefix}.href`} label="Goes to" />
    </div>
  );
}

export function NavEditor({ initial, fallback }: { initial: typeof DEFAULT_NAV; fallback: typeof DEFAULT_NAV }) {
  return (
    <ContentEditor contentKey="nav" initial={initial} fallback={fallback} previewHref="/">
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Section title="Top menu" description="The links across the top of every page. Use Up and Down to change the order.">
            <ListEditor form={form} path="header" itemLabel="link" blank={{ label: "", href: "/", menu: "none", links: [] }} max={8}>
              {(prefix) => (
                <>
                  <LinkFields form={form} prefix={prefix} />
                  <Choice form={form} path={`${prefix}.menu`} label="Menu that opens on hover" hint="Only shows on computers." options={MENUS} />
                  {form.get<string>(`${prefix}.menu`) === "custom" ? (
                    <ListEditor form={form} path={`${prefix}.links`} itemLabel="menu link" blank={BLANK_LINK} max={20}>
                      {(item) => <LinkFields form={form} prefix={item} />}
                    </ListEditor>
                  ) : null}
                </>
              )}
            </ListEditor>
          </Section>

          <Section title="Bottom of every page" description="The columns of links in the footer.">
            <ListEditor form={form} path="footer.columns" itemLabel="column" blank={{ title: "", links: [] }} max={5}>
              {(prefix) => (
                <>
                  <Text form={form} path={`${prefix}.title`} label="Column title" />
                  <ListEditor form={form} path={`${prefix}.links`} itemLabel="link" blank={BLANK_LINK} max={14}>
                    {(item) => <LinkFields form={form} prefix={item} />}
                  </ListEditor>
                </>
              )}
            </ListEditor>
          </Section>

          <Advanced form={form} under={["mobileLinks", "footer.copyright"]} label="Phone menu and small print">
            <Section title="Extra links on phones" description="Shown under the main links in the phone menu.">
              <ListEditor form={form} path="mobileLinks" itemLabel="link" blank={BLANK_LINK} max={12}>
                {(prefix) => <LinkFields form={form} prefix={prefix} />}
              </ListEditor>
            </Section>
            <Text form={form} path="footer.copyright" label="Small print at the very bottom" hint="Shown after the year and shop name." />
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}
