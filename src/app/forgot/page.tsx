import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-[460px] px-4 pb-24 pt-24 md:px-8">
      <PageTitle sub="Enter your email and we will send a link to choose a new password.">Forgot password</PageTitle>
      <div className="grid gap-6">
        <ForgotForm />
        <p className="text-sm text-muted">
          <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
