"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { postReview, type ReviewState } from "@/lib/actions/reviews";

const RATINGS = [1, 2, 3, 4, 5];

export function ReviewForm({ productId, hasReview }: { productId: string; hasReview: boolean }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(postReview, {});

  if (state.ok) return <p role="status" className="text-sm">Thank you. Your review is live.</p>;

  return (
    <form action={action} className="grid max-w-xl gap-5">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-2 text-sm">Rating</legend>
        <div className="flex gap-2">
          {RATINGS.map((rating) => (
            <label key={rating} className="flex size-11 cursor-pointer items-center justify-center border border-line text-[13px] hover:border-fg has-[:checked]:border-fg has-[:checked]:bg-invert-bg has-[:checked]:text-invert-fg has-[:focus-visible]:outline-2">
              <input type="radio" name="rating" value={rating} required className="sr-only" />
              {rating}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Title">
        <input name="title" required maxLength={120} className={inputClass} />
      </Field>
      <Field label="Your review">
        <textarea name="body" required minLength={10} maxLength={2000} rows={5} className={`${inputClass} h-auto py-3`} />
      </Field>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" look="outline" disabled={pending} className="justify-self-start">
        {pending ? "Posting" : hasReview ? "Update review" : "Post review"}
      </Button>
    </form>
  );
}
