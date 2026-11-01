import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <EmptyState
        title="We could not find that page"
        body="It may have moved, or the piece may no longer be in the collection."
        action={<LinkButton look="outline" href="/shop">Go to the shop</LinkButton>}
      />
    </div>
  );
}
