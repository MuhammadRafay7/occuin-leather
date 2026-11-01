import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormMessage } from "@/components/form-message";
import { PageTitle } from "@/components/ui";
import { getUser } from "@/lib/server/auth";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = await searchParams;
  const next = safeNext(query.next);
  if (await getUser()) redirect(next);

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-24 pt-24 md:px-8">
      <PageTitle>Sign in</PageTitle>
      <div className="grid gap-6">
        {query.reset === "1" ? <FormMessage notice="Your password is changed. Sign in with the new one." /> : null}
        <LoginForm next={next} />
        <p className="text-sm text-muted">
          <Link href="/forgot" className="underline underline-offset-4">Forgot your password?</Link>
        </p>
        <p className="text-sm text-muted">
          New to OCCUIN? <Link href={`/register?next=${encodeURIComponent(next)}`} className="underline underline-offset-4">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
