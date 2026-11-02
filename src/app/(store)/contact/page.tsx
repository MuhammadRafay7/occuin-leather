import { BlockView, Inline } from "@/components/content-blocks";
import { ContactForm } from "@/components/contact-form";
import { PageTitle } from "@/components/ui";
import { getAllTokens, getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/contact");

export default async function ContactPage() {
  const [page, tokens] = await Promise.all([getContent("page.contact"), getAllTokens()]);
  const [first, ...rest] = page.blocks;
  return (
    <div className="px-page pt-header">
      <PageTitle>{page.title}</PageTitle>
      <div className="grid gap-12 md:grid-cols-12">
        <div className="max-w-xl md:col-span-6">
          <ContactForm />
        </div>
        <div className="grid content-start gap-4 text-sm md:col-span-4 md:col-start-9 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-4 [&_li]:list-disc">
          {first ? <BlockView block={first} tokens={tokens} /> : null}
          {tokens.whatsapp_url && page.whatsappLine ? <p><Inline text={page.whatsappLine} tokens={tokens} /></p> : null}
          {rest.map((block, index) => <BlockView key={index} block={block} tokens={tokens} />)}
        </div>
      </div>
    </div>
  );
}
