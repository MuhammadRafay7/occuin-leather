"use client";

import type { DEFAULT_ABOUT, DEFAULT_CONTACT, DEFAULT_FAQ, StandardPage } from "@/lib/content/defaults";
import { Section } from "../../../_components/ui";
import { Advanced, BlocksEditor, ContentEditor, ImagePicker, ListEditor, Place, RichText, Text, type MediaOption } from "../../_components/editor";

export function StandardEditor({ contentKey, initial, fallback, preview }: { contentKey: string; initial: StandardPage; fallback: StandardPage; preview: string }) {
  return (
    <ContentEditor contentKey={contentKey} initial={initial} fallback={fallback} previewHref={preview}>
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Section title="Top of the page" description="The big title customers see first.">
            <div className="adm-stack">
              <Text form={form} path="title" label="Page title" />
              <RichText form={form} path="subtitle" label="Short line under the title" hint="Leave empty if you do not want one." rows={2} />
            </div>
          </Section>
          <Section title="What the page says" description="Each section title starts a new part of the page.">
            <BlocksEditor form={form} path="blocks" />
          </Section>
          <Advanced form={form} under={["notice"]} label="Important notice box">
            <RichText form={form} path="notice" label="Notice shown in a box at the top" hint="Leave empty to hide the box." rows={2} />
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}

export function AboutEditor({ initial, fallback, media, preview }: { initial: typeof DEFAULT_ABOUT; fallback: typeof DEFAULT_ABOUT; media: MediaOption[]; preview: string }) {
  return (
    <ContentEditor contentKey="page.about" initial={initial} fallback={fallback} previewHref={preview}>
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Section title="Top of the page" description="The title and big picture.">
            <div className="adm-stack">
              <Text form={form} path="title" label="Page title" />
              <ImagePicker form={form} path="image" label="Picture" media={media} />
              <Text form={form} path="imageAlt" label="Describe the picture" hint="Read aloud to people who cannot see it. Also helps Google." />
            </div>
          </Section>
          <Section title="Beside the picture" description="A few short paragraphs about you.">
            <BlocksEditor form={form} path="intro" kinds={["paragraph", "list"]} />
          </Section>
          <Section title="Design your own" description="The part that invites people into the studio.">
            <div className="adm-stack">
              <Text form={form} path="studioHeading" label="Title" />
              <RichText form={form} path="studioBody" label="Words" />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="studioCtaLabel" label="Button words" />
                <Place form={form} path="studioCtaHref" label="Button goes to" />
              </div>
            </div>
          </Section>
          <Section title="Questions and answers" description="The rest of the page.">
            <BlocksEditor form={form} path="blocks" />
          </Section>
        </div>
      )}
    </ContentEditor>
  );
}

export function FaqEditor({ initial, fallback, preview }: { initial: typeof DEFAULT_FAQ; fallback: typeof DEFAULT_FAQ; preview: string }) {
  return (
    <ContentEditor contentKey="page.faq" initial={initial} fallback={fallback} previewHref={preview}>
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Text form={form} path="title" label="Page title" />
          <Section title="Questions" description="Use Up and Down to change the order. These also appear in Google results.">
            <ListEditor form={form} path="items" itemLabel="question" blank={{ question: "", answer: "" }} emptyBody="The page shows a short message until you add one." max={80}>
              {(prefix) => (
                <>
                  <Text form={form} path={`${prefix}.question`} label="Question" />
                  <RichText form={form} path={`${prefix}.answer`} label="Answer" />
                </>
              )}
            </ListEditor>
          </Section>
        </div>
      )}
    </ContentEditor>
  );
}

export function ContactEditor({ initial, fallback, preview }: { initial: typeof DEFAULT_CONTACT; fallback: typeof DEFAULT_CONTACT; preview: string }) {
  return (
    <ContentEditor contentKey="page.contact" initial={initial} fallback={fallback} previewHref={preview}>
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Text form={form} path="title" label="Page title" />
          <Section title="Beside the contact form" description="Short notes shown next to the form.">
            <BlocksEditor form={form} path="blocks" kinds={["heading", "paragraph", "list"]} />
          </Section>
          <Advanced form={form} under={["whatsappLine"]} label="WhatsApp line">
            <RichText form={form} path="whatsappLine" label="Line about WhatsApp" hint="Only shows when a WhatsApp number is set in Settings." rows={2} />
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}
