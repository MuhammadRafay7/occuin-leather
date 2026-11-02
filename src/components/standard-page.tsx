import type { StandardPage } from "@/lib/content/defaults";
import { getAllTokens } from "@/lib/server/content";
import { BlockSections, Inline } from "./content-blocks";
import { PageNotice } from "./prose";
import { EmptyState, PageTitle } from "./ui";

export async function StandardPageView({ page }: { page: StandardPage }) {
  const tokens = await getAllTokens();
  return (
    <div className="px-page pt-header">
      <PageTitle sub={page.subtitle ? <Inline text={page.subtitle} tokens={tokens} /> : undefined}>{page.title}</PageTitle>
      {page.notice ? <PageNotice><Inline text={page.notice} tokens={tokens} /></PageNotice> : null}
      {page.blocks.length ? <BlockSections blocks={page.blocks} tokens={tokens} /> : <EmptyState title="Nothing here yet" body="This page is being updated. Please check back soon." />}
    </div>
  );
}
