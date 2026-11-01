import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { SaveButton } from "@/components/product/save-button";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { getOwnerKey } from "@/lib/server/auth";
import { getWishlist } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Saved items", robots: { index: false } };

export default async function WishlistPage() {
  const items = await getWishlist(await getOwnerKey());

  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Saved items</PageTitle>
      {items.length ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} />
              <SaveButton productId={product.id} productName={product.name} saved removeLabel="Remove" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing saved yet"
          body="Tap Save on any piece and it will wait for you here."
          action={<LinkButton look="outline" href="/shop">Go to the shop</LinkButton>}
        />
      )}
    </div>
  );
}
