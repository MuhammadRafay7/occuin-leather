import { Star } from "@phosphor-icons/react/dist/ssr";
import { BRAND, longDate } from "@/lib/format";
import { getReviews } from "@/lib/server/catalog";
import { ReviewGate } from "./review-gate";

const STARS = [1, 2, 3, 4, 5];

function Stars({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 5`} className="inline-flex gap-0.5">
      {STARS.map((star) => (
        <Star key={star} size={14} weight={star <= Math.round(value) ? "fill" : "regular"} aria-hidden />
      ))}
    </span>
  );
}

export async function Reviews({ productId, slug }: { productId: string; slug: string }) {
  const { average, total, items } = await getReviews(productId);

  return (
    <section aria-labelledby="reviews" className="mt-14 grid gap-6 border-t border-line pt-8 md:grid-cols-[1fr_2fr] md:gap-10">
      <div>
        <h2 id="reviews" className="font-display text-xl">Reviews</h2>
        {total ? (
          <p className="mt-3 flex items-center gap-3 text-[13px]">
            <Stars value={average} />
            {average.toFixed(1)} from {total} {total === 1 ? "review" : "reviews"}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-muted">No reviews yet.</p>
        )}
      </div>

      <div className="grid gap-10">
        {items.length ? (
          <ul className="grid gap-8">
            {items.map((item) => (
              <li key={item.id} className="grid gap-2">
                <Stars value={item.rating} />
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="max-w-[65ch] text-sm">{item.body}</p>
                <p className="text-xs text-muted">{item.author.split(" ")[0]}, {longDate(item.createdAt)}</p>
                {item.reply ? (
                  <div className="mt-1 max-w-[65ch] border-l border-line pl-3">
                    <p className="text-xs text-muted">Reply from {BRAND.name}{item.repliedAt ? `, ${longDate(item.repliedAt)}` : ""}</p>
                    <p className="whitespace-pre-line text-sm">{item.reply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <ReviewGate productId={productId} slug={slug} />
      </div>
    </section>
  );
}
