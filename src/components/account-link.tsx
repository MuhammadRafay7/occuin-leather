"use client";

import Link from "next/link";
import { useVisitor } from "@/components/visitor";

export function AccountLink({ className }: { className: string }) {
  const { signedIn } = useVisitor();
  return (
    <Link href={signedIn ? "/account" : "/login"} className={className}>
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
