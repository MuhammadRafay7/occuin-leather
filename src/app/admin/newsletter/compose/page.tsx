import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { countAudience } from "@/lib/server/campaigns";
import { mailConfigured } from "@/lib/server/mail";
import { AdminTitle, Tag } from "../../_components/ui";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "Write a newsletter" };

export default async function ComposeCampaign() {
  const actor = await requireAdmin();
  const audience = await countAudience();
  return (
    <>
      <AdminTitle back={{ href: "/admin/newsletter", label: "Newsletter" }} meta={<Tag>{audience} {audience === 1 ? "subscriber" : "subscribers"}</Tag>} sub="Write your email, send yourself a test, then send it to everyone.">Write a newsletter</AdminTitle>
      <ComposeForm audience={audience} testEmail={actor.email} mailReady={mailConfigured()} />
    </>
  );
}
