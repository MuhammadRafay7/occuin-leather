import type { Metadata } from "next";
import { LinkButton, PageTitle } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-24 pt-24 md:px-8">
      <PageTitle>Choose a new password</PageTitle>
      {typeof token === "string" && token ? (
        <ResetForm token={token} />
      ) : (
        <div className="grid justify-items-start gap-4">
          <p className="text-muted">This link is not valid or has expired.</p>
          <LinkButton href="/forgot" look="outline">Request a new link</LinkButton>
        </div>
      )}
    </div>
  );
}
