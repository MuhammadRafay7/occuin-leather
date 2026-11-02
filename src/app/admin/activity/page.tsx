import type { Icon } from "@phosphor-icons/react";
import { Article, ClockCounterClockwise, Clock, Envelope, EnvelopeSimple, FolderSimple, GearSix, Image as ImageIcon, Package, PaperPlaneTilt, Receipt, Scissors, ShoppingBag, Star, Tag as TagIcon, Ticket, UserCircle, Users } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { MoreMenu } from "../_components/people-controls";
import { FilterSelect, MoreFilters } from "../_components/people-ui";
import { AdminTitle, controlClass, Empty, Filters, ghostButtonClass, MetricCard, Pagination, Section, StatGrid } from "../_components/ui";
import { dateTime, param, shortDate, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { activityOptions, activityStats, countActivity, listActivity } from "../_lib/queries-people";
import { actionLabel, AREA_LABELS, sentenceFor } from "./sentence";

export const metadata: Metadata = { title: "Change history" };

const PATH = "/admin/activity";
const FILTER_KEYS = ["actor", "action", "target", "targetId", "from", "to"];
const DESTRUCTIVE = /\.(delete|remove|block)/;

const TARGET_ICONS: Record<string, Icon> = {
  activity: ClockCounterClockwise,
  bespoke: Scissors,
  campaign: PaperPlaneTilt,
  category: FolderSimple,
  content: Article,
  customer: UserCircle,
  media: ImageIcon,
  message: Envelope,
  order: Receipt,
  product: ShoppingBag,
  promo: Ticket,
  review: Star,
  settings: GearSix,
  subscriber: EnvelopeSimple,
  variant: Package,
};

const clock = (date: Date) => new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: "UTC" }).format(date);

type Entry = Awaited<ReturnType<typeof listActivity>>[number];

function groupByDay(rows: Entry[]) {
  const days = new Map<string, Entry[]>();
  for (const row of rows) days.set(shortDate(row.createdAt), [...(days.get(shortDate(row.createdAt)) ?? []), row]);
  return [...days];
}

function TimelineEntry({ row }: { row: Entry }) {
  const Glyph = TARGET_ICONS[row.targetType] ?? TagIcon;
  return (
    <li className="relative flex gap-3 py-2.5 pr-4 pl-4">
      <span className={`relative z-10 grid size-8 flex-none place-items-center rounded-full border border-line bg-bg ${DESTRUCTIVE.test(row.action) ? "text-danger" : "text-muted"}`}><Glyph size={15} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="max-w-[80ch] break-words" title={row.targetId ?? undefined}>{sentenceFor(row)}</p>
        <p className="mt-0.5 break-all text-xs text-muted">by {row.actorEmail}</p>
      </div>
      <time dateTime={row.createdAt.toISOString()} title={dateTime(row.createdAt)} className="flex-none pt-0.5 text-xs whitespace-nowrap text-muted tabular-nums">{clock(row.createdAt)}</time>
    </li>
  );
}

export default async function AdminActivity({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const [total, filters, stats] = await Promise.all([countActivity(search), activityOptions(), activityStats()]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listActivity(search, offset);
  const filtered = FILTER_KEYS.some((key) => param(search, key));
  const exportQuery = new URLSearchParams(FILTER_KEYS.flatMap((key) => (param(search, key) ? [[key, param(search, key)]] : []))).toString();
  const dateField = "grid min-w-0 flex-1 basis-[calc(50%-6px)] gap-1 text-xs text-muted sm:flex-none sm:basis-auto";

  return (
    <>
      <AdminTitle sub="A record of every change made in this admin panel. Times are in UTC." action={total ? <MoreMenu><a href={`/admin/activity/export${exportQuery ? `?${exportQuery}` : ""}`} className="adm-menu-item">Download this list (CSV)</a></MoreMenu> : undefined}>Change history</AdminTitle>
      <StatGrid columns={3}>
        <MetricCard label="Changes found" value={total.toLocaleString("en-US")} icon={<ClockCounterClockwise size={20} />} />
        <MetricCard label="Last 24 hours" value={stats.recent.toLocaleString("en-US")} icon={<Clock size={20} />} />
        <MetricCard label="People active, 24 hours" value={stats.actors} icon={<Users size={20} />} />
      </StatGrid>
      <Section title="What happened">
        <Filters path={PATH}>
          <label className={dateField}>
            Find
            <input name="targetId" type="search" defaultValue={param(search, "targetId")} placeholder="A name, email or word" className={`${controlClass} sm:w-52`} />
          </label>
          <FilterSelect label="What happened" name="action" value={param(search, "action")} options={[["", "Everything"], ...filters.actions.map((value): [string, string] => [value, actionLabel(value)])]} width="sm:w-56" />
          <FilterSelect label="Who" name="actor" value={param(search, "actor")} options={[["", "Everyone"], ...filters.actors.map((value): [string, string] => [value, value])]} width="sm:w-52" />
          <MoreFilters active={Boolean(param(search, "target") || param(search, "from") || param(search, "to"))}>
            <FilterSelect label="Area" name="target" value={param(search, "target")} options={[["", "All areas"], ...filters.targets.map((value): [string, string] => [value, AREA_LABELS[value] ?? value])]} width="sm:w-44" />
            <label className={dateField}>
              From
              <input name="from" type="date" defaultValue={param(search, "from")} className={`${controlClass} sm:w-40`} />
            </label>
            <label className={dateField}>
              To
              <input name="to" type="date" defaultValue={param(search, "to")} className={`${controlClass} sm:w-40`} />
            </label>
          </MoreFilters>
        </Filters>
        {rows.length ? (
          <>
            <div className="adm-card divide-y divide-line">
              {groupByDay(rows).map(([day, entries]) => (
                <section key={day} aria-label={day}>
                  <h3 className="flex items-center justify-between gap-2 bg-surface px-4 py-2 text-xs font-medium text-muted first:rounded-t-[var(--adm-radius)]">
                    {day}
                    <span className="tabular-nums">{entries.length}</span>
                  </h3>
                  <ol className="relative before:absolute before:inset-y-0 before:left-8 before:w-px before:bg-line">
                    {entries.map((row) => <TimelineEntry key={row.id} row={row} />)}
                  </ol>
                </section>
              ))}
            </div>
            <Pagination path={PATH} search={search} page={page} last={last} total={total} />
          </>
        ) : filtered ? (
          <Empty title="Nothing matches" body="Change the filters or clear them." action={<a href={PATH} className={ghostButtonClass}>Clear filters</a>} />
        ) : (
          <Empty title="No changes yet" body="Changes made in this admin panel appear here." />
        )}
      </Section>
    </>
  );
}
