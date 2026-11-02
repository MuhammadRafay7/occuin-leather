import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getUser } from "@/lib/server/auth";
import { safeNext } from "@/lib/safe-next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);

  return (
    <div className="mx-auto max-w-[460px] px-page pb-24 pt-header">
      <PageTitle sub="Your bag, saved items and designs carry over.">Create an account</PageTitle>
      <div className="grid gap-6">
        <RegisterForm next={next} />
        <p className="text-sm text-muted">
          Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
