import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, CreditCard, Database, EnvelopeSimple, Link as LinkIcon, WarningCircle, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";
import { AdminTitle, ContentGrid, Pairs, StatusDot, type Tone } from "../_components/ui";
import { dateTime } from "../_lib/format";
import { databaseReachable, latestWebhook } from "../_lib/queries-people";

export const metadata: Metadata = { title: "Site status" };

const MIN_SIGNING_SECRET = 32;

const CHECKS: [string, () => boolean][] = [
  ["DATABASE_URL", () => Boolean(process.env.DATABASE_URL)],
  ["Stripe secret key", () => Boolean(process.env.STRIPE_SECRET_KEY)],
  ["Stripe webhook secret", () => Boolean(process.env.STRIPE_WEBHOOK_SECRET)],
  ["Resend API key", () => Boolean(process.env.RESEND_API_KEY)],
  ["MAIL_FROM", () => Boolean(process.env.MAIL_FROM)],
  ["APP_URL", () => Boolean(process.env.APP_URL)],
  ["LINK_SIGNING_SECRET", () => (process.env.LINK_SIGNING_SECRET ?? "").length >= MIN_SIGNING_SECRET],
];

async function probeDatabase() {
  const started = performance.now();
  const reachable = await databaseReachable();
  return { reachable, latency: Math.round(performance.now() - started) };
}

type Service = { icon: Icon; title: string; tone: Tone; status: string; note: string };

const Card = ({ icon: Glyph, title, tone, status, note }: Service) => (
  <div className="adm-card flex flex-col gap-3 p-4">
    <h2 className="flex items-center gap-2"><Glyph size={16} aria-hidden="true" className="text-muted" />{title}</h2>
    <div><StatusDot tone={tone}>{status}</StatusDot></div>
    <p className="text-muted">{note}</p>
  </div>
);

export default async function AdminSystem() {
  await requireAdmin();
  const { reachable, latency } = await probeDatabase();
  const webhook = reachable ? await latestWebhook().catch(() => null) : null;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const results = CHECKS.map(([label, check]) => [label, check()] as const);
  const isSet = (...labels: string[]) => results.every(([label, set]) => !labels.includes(label) || set);
  const paymentsReady = isSet("Stripe secret key", "Stripe webhook secret");
  const mailReady = isSet("Resend API key", "MAIL_FROM");
  const linksReady = isSet("LINK_SIGNING_SECRET");
  const [settings, contact] = await Promise.all([getSettings().catch(() => null), contactDetails().catch(() => null)]);
  const whatsappMode = !settings || paymentModeOf(settings) === "whatsapp";
  const whatsappService: Service = contact?.whatsapp
    ? { icon: WhatsappLogo, title: "Payments", tone: "success", status: "On WhatsApp", note: "Customers order here and you arrange payment in a chat. Mark each order as paid when the money arrives." }
    : { icon: WhatsappLogo, title: "Payments", tone: "danger", status: "Needs setup", note: "No WhatsApp number is set. Orders still save, but customers are asked to email you. Add the number in Settings." };

  const services: Service[] = [
    reachable
      ? { icon: Database, title: "Store data", tone: "success", status: "Working", note: "Your products, orders and customers are safe to use." }
      : { icon: Database, title: "Store data", tone: "danger", status: "Not working", note: "The store cannot load or save anything. Contact your developer now." },
    whatsappMode
      ? whatsappService
      : !paymentsReady
      ? { icon: CreditCard, title: "Payments", tone: "warn", status: "Needs setup", note: "Customers cannot pay yet. Ask your developer to connect Stripe." }
      : webhook
        ? { icon: CreditCard, title: "Payments", tone: "success", status: "Working", note: `Stripe last updated us on ${dateTime(webhook)}.` }
        : { icon: CreditCard, title: "Payments", tone: "muted", status: "Waiting for first payment", note: "Stripe is connected. This turns to Working after the first payment." },
    mailReady
      ? { icon: EnvelopeSimple, title: "Email", tone: "success", status: "Working", note: "Order emails, replies and newsletters can be sent." }
      : { icon: EnvelopeSimple, title: "Email", tone: "warn", status: "Needs setup", note: "No emails can be sent yet. Ask your developer to connect Resend." },
    linksReady
      ? { icon: LinkIcon, title: "Secure links", tone: "success", status: "Working", note: "Links in customer emails are protected." }
      : { icon: LinkIcon, title: "Secure links", tone: "warn", status: "Needs setup", note: "Ask your developer to add the secure link key, so emailed links stay safe." },
  ];
  const problems = services.filter((service) => service.status === "Needs setup" || service.status === "Not working").length;

  return (
    <>
      <AdminTitle sub="A quick check that the services behind your store are working.">Site status</AdminTitle>
      <p role="status" className="adm-notice mb-4 flex items-center gap-2" data-tone={problems ? "danger" : undefined}>
        {problems ? <WarningCircle size={16} aria-hidden="true" className="flex-none" /> : <CheckCircle size={16} aria-hidden="true" className="flex-none" />}
        {problems ? `${problems} ${problems === 1 ? "thing needs" : "things need"} your attention.` : "Everything is working."}
      </p>
      <ContentGrid cols={4}>
        {services.map((service) => <Card key={service.title} {...service} />)}
      </ContentGrid>
      <details className="adm-card mt-4">
        <summary className="cursor-pointer px-4 py-3 font-medium">Details for your developer</summary>
        <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
          <Pairs rows={results.map(([label, set]) => [label, set ? "Set" : "Missing"])} />
          <Pairs
            rows={[
              ["Environment", process.env.NODE_ENV],
              ["Region", process.env.VERCEL_REGION ?? "Not available"],
              ["Deployment commit", commit ? <code key="commit">{commit}</code> : "Not available"],
              ["Database response", reachable ? `${latency} ms` : "No response"],
              ["Latest webhook", webhook ? dateTime(webhook) : "None received"],
            ]}
          />
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">Shows whether each value is set, never the value. Checked when this page loads.</p>
      </details>
    </>
  );
}
