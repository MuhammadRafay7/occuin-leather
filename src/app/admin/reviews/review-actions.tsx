"use client";

import { Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { deleteReview, replyToReview, setReviewHidden } from "@/lib/actions/admin-catalog";
import { Thumb } from "../_components/catalog-ui";
import { ConfirmButton } from "../_components/confirm-button";
import { ActionButton, useAction } from "../_components/controls";
import { buttonClass, linkClass, Notice, StatusDot, textAreaClass } from "../_components/ui";

export type ReviewView = {
  id: string;
  rating: number;
  title: string;
  body: string;
  hidden: boolean;
  reply: string;
  date: string;
  author: string;
  email: string;
  productName: string;
  productImage: string | null;
  productHref: string;
  productInStore: boolean;
};

function useReply({ id, reply }: ReviewView) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply);
  const { pending, result, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => replyToReview(id, text), (outcome) => { if (outcome.ok) setEditing(false); });
  }

  return { editing, setEditing, text, setText, pending, result, submit };
}

type Reply = ReturnType<typeof useReply>;

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={13} weight={star <= rating ? "fill" : "regular"} aria-hidden="true" className={star <= rating ? "text-fg" : "text-muted"} />
      ))}
    </span>
  );
}

function ReviewText({ review, state }: { review: ReviewView; state: Reply }) {
  const { editing, setEditing, text, setText, pending, result, submit } = state;
  return (
    <div className="grid gap-2">
      <div>
        <Stars rating={review.rating} />
        <p className="font-medium">{review.title}</p>
        <p className="max-w-[70ch] whitespace-pre-line break-words">{review.body}</p>
      </div>
      {review.reply && !editing ? (
        <blockquote className="max-w-[70ch] border-l-2 border-line pl-3">
          <span className="block text-xs text-muted">Your reply</span>
          <span className="whitespace-pre-line break-words">{review.reply}</span>
        </blockquote>
      ) : null}
      {editing ? (
        <form onSubmit={submit} className="grid max-w-xl gap-2">
          <label className="grid gap-1 text-xs text-muted">
            Your reply shows publicly under the review. Leave it empty to remove it.
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={2000} className={textAreaClass} />
          </label>
          <div className="flex flex-wrap gap-1">
            <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving" : "Publish reply"}</button>
            <button type="button" disabled={pending} onClick={() => { setText(review.reply); setEditing(false); }} className={buttonClass}>Cancel</button>
          </div>
        </form>
      ) : null}
      <Notice result={result} compact />
    </div>
  );
}

function Actions({ review, state }: { review: ReviewView; state: Reply }) {
  return (
    <>
      {state.editing ? null : <button type="button" onClick={() => state.setEditing(true)} className={buttonClass}>{review.reply ? "Edit reply" : "Reply"}</button>}
      <ActionButton action={() => setReviewHidden(review.id, !review.hidden)}>{review.hidden ? "Show" : "Hide"}</ActionButton>
      <ConfirmButton action={() => deleteReview(review.id)} prompt="Delete this review for good? You cannot undo this." confirmLabel="Yes, delete">Delete</ConfirmButton>
    </>
  );
}

function Chips({ review }: { review: ReviewView }) {
  return (
    <div className="flex flex-wrap gap-1">
      {review.hidden ? <StatusDot tone="danger">Hidden</StatusDot> : <StatusDot tone="success">Showing</StatusDot>}
      {review.reply ? <StatusDot>Replied</StatusDot> : null}
    </div>
  );
}

function Product({ review }: { review: ReviewView }) {
  return (
    <div className="flex items-center gap-3">
      <Thumb src={review.productImage} />
      <div className="min-w-0">
        <Link href={review.productHref} target={review.productInStore ? "_blank" : undefined} className={`${linkClass} block break-words`}>{review.productName}</Link>
        <span className="block break-words text-xs text-muted">{review.author}, {review.email}</span>
      </div>
    </div>
  );
}

export function ReviewRow({ review }: { review: ReviewView }) {
  const state = useReply(review);
  return (
    <tr>
      <td className="min-w-72 align-top"><ReviewText review={review} state={state} /></td>
      <td className="w-60 align-top"><Product review={review} /></td>
      <td className="w-28 align-top"><Chips review={review} /></td>
      <td className="w-32 align-top text-xs text-muted">{review.date}</td>
      <td className="w-32 align-top">
        <div className="flex flex-wrap items-start justify-end gap-1"><Actions review={review} state={state} /></div>
      </td>
    </tr>
  );
}

export function ReviewCard({ review }: { review: ReviewView }) {
  const state = useReply(review);
  return (
    <li className="adm-card grid content-start gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chips review={review} />
        <span className="text-xs text-muted">{review.date}</span>
      </div>
      <ReviewText review={review} state={state} />
      <div className="border-t border-line pt-3"><Product review={review} /></div>
      <div className="flex flex-wrap items-start gap-1"><Actions review={review} state={state} /></div>
    </li>
  );
}
