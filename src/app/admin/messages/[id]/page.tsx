import { ChatCircleText, Info, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { setMessageHandled } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/server/auth";
import { mailConfigured } from "@/lib/server/mail";
import { ActionButton } from "../../_components/controls";
import { Avatar, IconHeading } from "../../_components/people-ui";
import { AdminTitle, DetailGrid, Pairs, Panel, StatusDot, Tag } from "../../_components/ui";
import { dateTime } from "../../_lib/format";
import { getMessage } from "../../_lib/queries-people";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Message" };

const Entry = ({ name, meta, children }: { name: string; meta: string; children: ReactNode }) => (
  <article className="flex gap-3 p-4">
    <Avatar name={name} />
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted">{meta}</span>
      </p>
      <p className="mt-1 max-w-[70ch] whitespace-pre-wrap break-words">{children}</p>
    </div>
  </article>
);

export default async function AdminMessage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const message = await getMessage(id);
  if (!message) notFound();

  return (
    <>
      <AdminTitle
        back={{ href: "/admin/messages", label: "Messages" }}
        meta={(
          <>
            {message.handled ? <StatusDot tone="muted">Done</StatusDot> : <StatusDot tone="warn">Open</StatusDot>}
            {message.repliedAt ? <Tag tone="muted">Replied</Tag> : null}
          </>
        )}
        sub={<>{message.email}, {dateTime(message.createdAt)}</>}
        action={<ActionButton action={setMessageHandled.bind(null, message.id, !message.handled)}>{message.handled ? "Reopen" : "Mark as done"}</ActionButton>}
      >
        {message.name}
      </AdminTitle>
      <DetailGrid
        main={(
          <>
            <Panel title={<IconHeading icon={ChatCircleText}>Conversation</IconHeading>} flush>
              <div className="divide-y divide-line">
                <Entry name={message.name} meta={dateTime(message.createdAt)}>{message.message}</Entry>
                {message.repliedAt ? <Entry name="Your reply" meta={`Sent ${dateTime(message.repliedAt)}`}>{message.reply}</Entry> : null}
              </div>
            </Panel>
            <Panel title={<IconHeading icon={PaperPlaneTilt}>{message.repliedAt ? "Send another reply" : "Reply"}</IconHeading>}>
              <ReplyForm messageId={message.id} email={message.email} mailReady={mailConfigured()} seenRepliedAt={message.repliedAt?.toISOString() ?? null} />
            </Panel>
          </>
        )}
        side={(
          <Panel title={<IconHeading icon={Info}>Details</IconHeading>}>
            <Pairs rows={[["From", message.name], ["Email", message.email], ["Topic", message.topic], ["Received", dateTime(message.createdAt)]]} />
          </Panel>
        )}
      />
    </>
  );
}
