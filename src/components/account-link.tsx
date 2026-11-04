"use client";

import { User } from "@phosphor-icons/react";
import Link from "next/link";
import { useVisitor } from "@/components/visitor";

export function AccountLink({ className }: { className: string }) {
  const { signedIn } = useVisitor();
  const label = signedIn ? "Account" : "Sign in";
  return (
    <Link href={signedIn ? "/account" : "/login"} aria-label={label} title={label} className={className}>
      <User size={19} weight={signedIn ? "fill" : "light"} />
    </Link>
  );
}
