import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { COOKIES } from "../admin/_components/nav-items";
import "../admin/admin.css";

export default async function AdminAuthLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get(COOKIES.theme)?.value === "dark" ? "dark" : "light";
  return <div className="adm" data-theme={theme}>{children}</div>;
}
