"use client";

import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { STORY_STEPS } from "@/lib/home/story";
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
              <div className="grid gap-3 md:grid-cols-3">
                <Text form={form} path="hero.secondaryLabel" label="Second link words" />
                <Place form={form} path="hero.secondaryHref" label="Second link goes to" />
                <Text form={form} path="hero.cueLabel" label="Scroll hint words" hint="Shown on larger screens." />
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

          <Section title="New in" description="Shows your newest products that are not already in Pick your shape. It hides itself when fewer than 2 are left.">
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

          <Section title="Bag built step by step" description="The 3D bag that comes together as people scroll, ending with a button to make it.">
            <div className="adm-stack">
              <Toggle form={form} path="story.visible" label="Show this on the home page" />
              <div className="grid gap-3 md:grid-cols-2">
                <Choice form={form} path="story.preset" label="Bag shape shown" options={presets} />
                <Choice form={form} path="story.slug" label="Product it opens" options={products} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="story.eyebrow" label="Small words above the title" />
                <Text form={form} path="story.heading" label="Title" />
              </div>
              <RichText form={form} path="story.intro" label="Words under the title" rows={2} />
              {STORY_STEPS.map((step, index) => (
                <div key={step} className="grid gap-3 md:grid-cols-[1fr_2fr]">
                  <Text form={form} path={`story.steps.${step}.title`} label={`Step ${index + 1} title`} />
                  <Text form={form} path={`story.steps.${step}.body`} label={`Step ${index + 1} words`} rows={2} />
                </div>
              ))}
              <Text form={form} path="story.endHeading" label="Last card title" />
              <RichText form={form} path="story.endBody" label="Last card words" rows={2} />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="story.ctaLabel" label="Studio button words" />
                <Text form={form} path="story.productLabel" label="Product button words" />
              </div>
            </div>
          </Section>

          <Section title="Pick your shape" description="A row of every bag that opens in the studio, with its price.">
            <div className="adm-stack">
              <Toggle form={form} path="shapes.visible" label="Show this on the home page" />
              <Text form={form} path="shapes.heading" label="Title" />
              <RichText form={form} path="shapes.body" label="Words" rows={2} />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="shapes.linkLabel" label="Link words" />
                <Place form={form} path="shapes.linkHref" label="Link goes to" />
              </div>
            </div>
          </Section>

          <Section title="Leather close-up" description="A large leather sample people can light with a finger or cursor.">
            <div className="adm-stack">
              <Toggle form={form} path="leathers.visible" label="Show this on the home page" />
              <div className="grid gap-3 md:grid-cols-2">
                <Text form={form} path="leathers.eyebrow" label="Small words above the title" />
                <Text form={form} path="leathers.heading" label="Title" />
              </div>
              <RichText form={form} path="leathers.body" label="Words" rows={2} />
              <Text form={form} path="leathers.ctaLabel" label="Button words" hint="The colour name is added after these words." />
            </div>
          </Section>

          <Section title="How your bag is made" description="Numbered steps from order to delivery. Live details such as making time stay up to date.">
            <div className="adm-stack">
              <Toggle form={form} path="making.visible" label="Show this on the home page" />
              <Text form={form} path="making.heading" label="Title" />
              <ListEditor form={form} path="making.steps" itemLabel="step" blank={{ title: "", body: "" }} max={6}>
                {(prefix) => (
                  <>
                    <Text form={form} path={`${prefix}.title`} label="Step title" />
                    <RichText form={form} path={`${prefix}.body`} label="Step words" rows={2} />
                  </>
                )}
              </ListEditor>
            </div>
          </Section>

          <Section title="Where to start" description="The closing row of links at the bottom of the page.">
            <div className="adm-stack">
              <Toggle form={form} path="paths.visible" label="Show this on the home page" />
              <Text form={form} path="paths.heading" label="Title" />
              <ListEditor form={form} path="paths.links" itemLabel="link" blank={{ label: "", href: "/shop/leather", note: "" }} max={6}>
                {(prefix) => (
                  <div className="grid gap-3 md:grid-cols-3">
                    <Text form={form} path={`${prefix}.label`} label="Link words" />
                    <Place form={form} path={`${prefix}.href`} label="Goes to" />
                    <Text form={form} path={`${prefix}.note`} label="Short note" />
                  </div>
                )}
              </ListEditor>
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
