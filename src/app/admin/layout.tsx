import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/server/auth";
import { COOKIES } from "./_components/nav-items";
import { AdminShell } from "./_components/shell";
import { navCounts } from "./_lib/queries-people";
import "./admin.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const [counts, jar] = await Promise.all([navCounts(), cookies()]);

  return (
    <AdminShell
      account={{ id: user.id, name: user.name, email: user.email }}
      counts={counts}
      attention={counts.ordersWaiting + counts.messagesOpen + counts.bespokeNew}
      theme={jar.get(COOKIES.theme)?.value === "dark" ? "dark" : "light"}
      rail={jar.get(COOKIES.rail)?.value === "1"}
    >
      {children}
    </AdminShell>
  );
}
