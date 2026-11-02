"use client";

import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { Section } from "../../_components/ui";
import { Advanced, Choice, ContentEditor, ImagePicker, ListEditor, Numeric, Place, RichText, Text, Toggle, type MediaOption } from "../_components/editor";

type Option = { value: string; label: string };
type Props = { initial: typeof DEFAULT_HOME; fallback: typeof DEFAULT_HOME; media: MediaOption[]; presets: Option[]; leathers: Option[]; products: Option[] };

const PICTURE_HELP = "Read aloud to people who cannot see it. Also helps Google.";

export function HomeEditor({ initial, fallback, media, presets, leathers, products }: Props) {
  return (
    <ContentEditor contentKey="home" initial={initial} fallback={fallback} previewHref="/">
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <Section title="Big welcome at the top" description="The large words and the 3D bag people see first.">
            <div className="adm-stack">
              <div className="grid gap-3 md:grid-cols-3">
                <Text form={form} path="hero.lineOne" label="First line" hint="Short works best." />
                <Text form={form} path="hero.lineTwo" label="Second line" hint="Short works best." />
                <Text form={form} path="hero.ctaLabel" label="Button words" />
              </div>
            </div>
          </Section>

          <Section title="Bags to try in 3D" description="The styles people can switch between at the top of the page.">
            <ListEditor form={form} path="hero.forms" itemLabel="style" blank={{ key: presets[0]?.value ?? "", label: "", slug: products[0]?.value ?? "" }} max={5}>
              {(prefix) => (
                <div className="grid gap-3 md:grid-cols-3">
                  <Text form={form} path={`${prefix}.label`} label="Name on the button" />
                  <Choice form={form} path={`${prefix}.key`} label="Bag shape shown" options={presets} />
                  <Choice form={form} path={`${prefix}.slug`} label="Product it opens" options={products} />
                </div>
              )}
            </ListEditor>
          </Section>

          <Section title="Leather colours to try" description="The first colour shows when the page opens.">
            <ListEditor form={form} path="hero.leathers" itemLabel="leather" blank={leathers[0]?.value ?? ""} max={7}>
              {(prefix) => <Choice form={form} path={prefix} label="Colour" options={leathers} />}
            </ListEditor>
          </Section>

          <Section title="Category pictures" description="The row of pictures that lead into the shop.">
            <div className="adm-stack">
              <Toggle form={form} path="categories.visible" label="Show this on the home page" />
              <ListEditor form={form} path="categories.items" itemLabel="picture" blank={{ href: "/shop/leather", name: "", image: "/images/og.jpg", alt: "" }} max={8}>
                {(prefix) => (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Text form={form} path={`${prefix}.name`} label="Name under the picture" />
                      <Place form={form} path={`${prefix}.href`} label="Goes to" />
                    </div>
                    <ImagePicker form={form} path={`${prefix}.image`} label="Picture" media={media} />
                    <Text form={form} path={`${prefix}.alt`} label="Describe the picture" hint={PICTURE_HELP} />
                  </>
                )}
              </ListEditor>
            </div>
          </Section>

          <Section title="New in" description="Shows products marked as featured.">
            <div className="adm-stack">
              <Toggle form={form} path="featured.visible" label="Show this on the home page" />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="featured.heading" label="Title" />
                <Numeric form={form} path="featured.limit" label="How many products to show" hint="From 1 to 8." step="1" />
                <Text form={form} path="featured.linkLabel" label="Link words" />
                <Place form={form} path="featured.linkHref" label="Link goes to" />
              </div>
            </div>
          </Section>

          <Section title="Design your own" description="The large invitation to the studio.">
            <div className="adm-stack">
              <Toggle form={form} path="studio.visible" label="Show this on the home page" />
              <Text form={form} path="studio.heading" label="Title" />
              <RichText form={form} path="studio.body" label="Words" />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="studio.ctaLabel" label="Button words" />
                <Place form={form} path="studio.ctaHref" label="Button goes to" />
              </div>
              <ImagePicker form={form} path="studio.image" label="Picture" media={media} />
              <Text form={form} path="studio.imageAlt" label="Describe the picture" hint={PICTURE_HELP} />
            </div>
          </Section>

          <Section title="About us" description="A short note near the bottom. Good for Google too.">
            <div className="adm-stack">
              <Toggle form={form} path="about.visible" label="Show this on the home page" />
              <Text form={form} path="about.heading" label="Title" />
              <RichText form={form} path="about.body" label="Words" rows={4} />
            </div>
          </Section>

          <Advanced form={form} under={["hero.fallbackImage", "hero.fallbackAlt"]} label="Picture for phones that cannot show 3D">
            <ImagePicker form={form} path="hero.fallbackImage" label="Picture" media={media} />
            <Text form={form} path="hero.fallbackAlt" label="Describe the picture" hint={PICTURE_HELP} />
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}
