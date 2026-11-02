import type { Metadata } from "next";
import { connection } from "next/server";
import { EmptyState, LinkButton } from "@/components/ui";
import { getContent } from "@/lib/server/content";
import StoreLayout from "./(store)/layout";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const seo = await getContent("seo");
  return { title: { absolute: seo.siteTitle }, description: seo.siteDescription };
}

export default function NotFound() {
  return (
    <StoreLayout>
      <div className="px-page pt-header">
        <EmptyState
          title="We could not find that page"
          body="It may have moved, or the piece may no longer be in the collection."
          action={<LinkButton look="outline" href="/shop">Go to the shop</LinkButton>}
        />
      </div>
    </StoreLayout>
  );
}
