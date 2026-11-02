import { Inline } from "@/components/content-blocks";
import { EmptyState, PageTitle } from "@/components/ui";
import { fillTokens } from "@/lib/content/rich-text";
import { faqData, jsonLd } from "@/lib/seo";
import { getAllTokens, getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/faq");

export default async function FaqPage() {
  const [page, tokens] = await Promise.all([getContent("page.faq"), getAllTokens()]);
  const structured = page.items.map((item) => ({ question: item.question, answer: fillTokens(item.answer, tokens) }));
  return (
    <div className="px-page pt-header">
      {page.items.length ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqData(structured))} /> : null}
      <PageTitle>{page.title}</PageTitle>
      {page.items.length ? (
        <div className="max-w-3xl">
          {page.items.map((item) => (
            <details key={item.question} className="group border-t border-line last:border-b">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden className="text-lg leading-none group-open:hidden">+</span>
                <span aria-hidden className="hidden text-lg leading-none group-open:inline">-</span>
              </summary>
              <p className="max-w-[65ch] pb-5 text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4"><Inline text={item.answer} tokens={tokens} /></p>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState title="No questions yet" body="Write to us and we will help." />
      )}
    </div>
  );
}
