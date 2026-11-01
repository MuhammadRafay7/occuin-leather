import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/server/auth";
import { AdminNav } from "./_components/nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-16 pt-24 md:grid-cols-[160px_minmax(0,1fr)] md:gap-10 md:px-8">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
