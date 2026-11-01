import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  return (
    <>
      <PageTitle>Profile</PageTitle>
      <div className="grid max-w-[520px] gap-14">
        <section aria-labelledby="details-title" className="grid gap-5">
          <h2 id="details-title" className="font-display text-2xl">Your details</h2>
          <ProfileForm name={user.name} email={user.email} />
        </section>
        <section aria-labelledby="password-title" className="grid gap-5">
          <h2 id="password-title" className="font-display text-2xl">Change password</h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
