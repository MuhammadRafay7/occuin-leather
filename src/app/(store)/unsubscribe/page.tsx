import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { verifyUnsubscribe } from "@/lib/server/unsubscribe";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

type Search = Record<string, string | string[] | undefined>;
const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const email = text(search.email);
  const token = text(search.token);
  const valid = Boolean(email && token && verifyUnsubscribe(email, token));
  return (
    <div className="px-page pt-header">
      <PageTitle>Unsubscribe</PageTitle>
      {valid ? <UnsubscribeForm email={email} token={token} /> : <p className="max-w-md text-sm">This link is not valid. Use the link in the most recent newsletter, or write to us from the contact page.</p>}
    </div>
  );
}
