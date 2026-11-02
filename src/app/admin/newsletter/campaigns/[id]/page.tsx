import { ChartBar, EnvelopeOpen } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { getCampaign } from "@/lib/server/campaigns";
import { mailConfigured } from "@/lib/server/mail";
import { IconHeading } from "../../../_components/people-ui";
import { AdminTitle, DetailGrid, Panel } from "../../../_components/ui";
import { dateTime, param, type SearchParams } from "../../../_lib/format";
import { CampaignRunner } from "./campaign-runner";

export const metadata: Metadata = { title: "Newsletter" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const search = await searchParams;

  return (
    <>
      <AdminTitle back={{ href: "/admin/newsletter", label: "Newsletter" }} sub={`Started ${dateTime(campaign.createdAt)} by ${campaign.actorEmail}`}>{campaign.subject}</AdminTitle>
      <DetailGrid
        main={(
          <Panel title={<IconHeading icon={EnvelopeOpen}>Message</IconHeading>}>
            <pre className="max-w-[70ch] whitespace-pre-wrap break-words font-sans text-sm">{campaign.body}</pre>
          </Panel>
        )}
        side={(
          <Panel title={<IconHeading icon={ChartBar}>Sending progress</IconHeading>}>
            <CampaignRunner initial={campaign} autoStart={param(search, "run") === "1"} mailReady={mailConfigured()} />
          </Panel>
        )}
      />
    </>
  );
}
