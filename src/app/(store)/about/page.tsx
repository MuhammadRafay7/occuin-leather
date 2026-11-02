import Image from "next/image";
import { BlockSections, BlockView, Inline } from "@/components/content-blocks";
import { LinkButton, PageTitle } from "@/components/ui";
import { jsonLd, organizationData } from "@/lib/seo";
import { getAllTokens, getContent, pageMetadata } from "@/lib/server/content";
import { contactDetails } from "@/lib/server/settings";

export const generateMetadata = () => pageMetadata("/about");

export default async function AboutPage() {
  const [{ email }, page, seo, tokens] = await Promise.all([contactDetails(), getContent("page.about"), getContent("seo"), getAllTokens()]);
  return (
    <div className="px-page pt-header">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationData(email, seo.organizationDescription))} />
      <PageTitle>{page.title}</PageTitle>
      <div className="grid gap-10 md:grid-cols-12">
        <div className="relative aspect-[4/3] bg-surface md:col-span-7">
          <Image src={page.image} alt={page.imageAlt} fill sizes="(min-width: 768px) 58vw, 100vw" preload unoptimized={page.image.startsWith("/api/")} className="object-cover" />
        </div>
        <div className="grid content-end justify-items-start gap-5 md:col-span-4 md:col-start-9 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-4 [&_li]:list-disc">
          {page.intro.map((block, index) => <BlockView key={index} block={block} tokens={tokens} />)}
        </div>
      </div>

      <section className="mt-24 grid justify-items-start gap-5 md:grid-cols-[1fr_1fr]">
        <h2 className="font-display text-4xl leading-none md:text-6xl">{page.studioHeading}</h2>
        <div className="grid justify-items-start gap-5">
          <p className="max-w-[50ch] [&_a]:underline [&_a]:underline-offset-4"><Inline text={page.studioBody} tokens={tokens} /></p>
          <LinkButton look="outline" href={page.studioCtaHref}>{page.studioCtaLabel}</LinkButton>
        </div>
      </section>

      {page.blocks.length ? (
        <div className="mt-24">
          <BlockSections blocks={page.blocks} tokens={tokens} />
        </div>
      ) : null}
    </div>
  );
}
