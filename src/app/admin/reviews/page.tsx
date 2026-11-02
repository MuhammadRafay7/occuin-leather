import { ChatCircleDots, EyeSlash, Stack, Star } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { FilterSelect, StatStrip } from "../_components/catalog-ui";
import { AdminTitle, buttonClass, Empty, Filters, MetricCard, Pagination, Table } from "../_components/ui";
import { dateTime, param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countReviews, listReviews } from "../_lib/queries-catalog";
import { averageVisibleRating } from "../_lib/queries-catalog-stats";
import { ReviewCard, ReviewRow, type ReviewView } from "./review-actions";

export const metadata: Metadata = { title: "Reviews" };

const STATE_OPTIONS = [["", "All reviews"], ["visible", "Showing"], ["hidden", "Hidden"], ["unanswered", "No reply yet"], ["replied", "Replied"]] as const;
const RATING_OPTIONS: [string, string][] = [["", "Any"], ...[5, 4, 3, 2, 1].map((stars): [string, string] => [String(stars), `${stars} ${stars === 1 ? "star" : "stars"}`])];
const EVERY_REVIEW = { q: "", state: "", rating: "" };

export default async function AdminReviews({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const query = { q: param(search, "q"), state: param(search, "state"), rating: param(search, "rating") };
  const [total, all, hidden, unanswered, rating] = await Promise.all([
    countReviews(query),
    countReviews(EVERY_REVIEW),
    countReviews({ ...EVERY_REVIEW, state: "hidden" }),
    countReviews({ ...EVERY_REVIEW, state: "unanswered" }),
    averageVisibleRating(),
  ]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listReviews(query, offset);
  const filtered = Boolean(query.q || query.state || query.rating);
  const views: ReviewView[] = rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    hidden: Boolean(review.hiddenAt),
    reply: review.reply ?? "",
    date: dateTime(review.createdAt),
    author: review.author,
    email: review.email,
    productName: review.productName,
    productImage: review.productImage,
    productHref: review.productActive ? `/product/${review.productSlug}` : `/admin/products/${review.productId}`,
    productInStore: review.productActive,
  }));

  return (
    <>
      <AdminTitle sub="What customers say about your pieces. Reply to a review, or hide it from the store.">Reviews</AdminTitle>
      <StatStrip>
        <MetricCard icon={<Stack size={18} />} label="All reviews" value={all} href="/admin/reviews" />
        <MetricCard icon={<Star size={18} />} label="Average rating" value={rating.average === null ? "None yet" : rating.average.toFixed(1)} description={rating.average === null ? undefined : "Out of 5"} />
        <MetricCard icon={<ChatCircleDots size={18} />} label="No reply yet" value={unanswered} href="/admin/reviews?state=unanswered" />
        <MetricCard icon={<EyeSlash size={18} />} label="Hidden" value={hidden} href="/admin/reviews?state=hidden" />
      </StatStrip>
      <Filters path="/admin/reviews" q={query.q} placeholder="Words, product or customer">
        <FilterSelect label="Show" name="state" value={query.state} width="w-36" options={STATE_OPTIONS} />
        <FilterSelect label="Rating" name="rating" value={query.rating} width="w-28" options={RATING_OPTIONS} />
      </Filters>

      {rows.length ? (
        <>
          <ul className="grid items-start gap-2 md:grid-cols-2 lg:hidden">
            {views.map((review) => <ReviewCard key={review.id} review={review} />)}
          </ul>
          <div className="hidden lg:block">
            <Table caption="Reviews" head={["Review", "Product", "Status", "Date", "Actions"]} right={["Actions"]} minWidth="min-w-[860px]">
              {views.map((review) => <ReviewRow key={review.id} review={review} />)}
            </Table>
          </div>
          <Pagination path="/admin/reviews" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={filtered ? "No reviews match" : "No reviews yet"}
          body={filtered ? "Try other filters." : "Reviews from customers who bought a piece show here."}
          action={filtered ? <Link href="/admin/reviews" className={buttonClass}>Clear filters</Link> : undefined}
        />
      )}
    </>
  );
}
