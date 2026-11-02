import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "../../../admin/_components/brand";
import { getUser } from "@/lib/server/auth";
import { safeAdminNext } from "@/lib/safe-next";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in to admin", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const next = safeAdminNext((await searchParams).next);
  const user = await getUser();
  if (user) redirect(user.role === "admin" ? next : "/");

  return (
    <main className="adm-login">
      <div className="adm-login-card">
        <div className="mb-6 flex items-center gap-2">
          <span className="adm-brand-tile"><BrandMark size={20} /></span>
          <span className="adm-brand-text">
            <strong>OCCUIN</strong>
            <small>Admin</small>
          </span>
        </div>
        <div className="adm-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mb-5 mt-1 text-muted">For the OCCUIN team.</p>
          <AdminLoginForm next={next} />
        </div>
        <p className="mt-4 text-center text-xs text-muted"><Link href="/forgot" className="hover:text-fg">Forgot your password?</Link></p>
      </div>
    </main>
  );
}
