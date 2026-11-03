import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { z } from "zod";
import { Studio, type StudioInitial } from "@/components/studio/studio";
import { getStudioRates, pageMetadata } from "@/lib/server/content";
import { getOwnerKey } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/catalog";
import { cleanInitials, INITIALS_PATTERN, withInitials } from "@/lib/studio/initials";
import { db, schema } from "@/lib/server/db";
import { COLORS, designSpecSchema, FINISHES, METALS, normalizeSpec, THREADS, type ColorKey, type DesignSpec } from "@/lib/studio/spec";

type Param = string | string[];
type Params = { from?: Param; design?: Param; color?: Param; initials?: Param; finish?: Param; thread?: Param; metal?: Param };
type Look = { finish?: Param; thread?: Param; metal?: Param };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { design } = await searchParams;
  const meta = await pageMetadata("/studio");
  return design ? { ...meta, robots: { index: false, follow: true } } : meta;
}

async function loadDesign(id: string): Promise<StudioInitial> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return null;
  const owner = await getOwnerKey();
  const [row] = await db.select().from(schema.designs).where(eq(schema.designs.id, parsedId.data));
  if (!row) return null;
  const spec = designSpecSchema.safeParse(row.spec);
  if (!spec.success) return null;
  return { spec: spec.data, designId: row.id, source: `design:${row.id}`, owned: row.ownerKey === owner };
}

const isColor = (value: unknown): value is ColorKey => typeof value === "string" && Object.hasOwn(COLORS, value);
const keyOf = <T extends object>(table: T, value: unknown) => (typeof value === "string" && Object.hasOwn(table, value) ? (value as keyof T) : null);

function dressed(spec: DesignSpec, color: unknown, { finish, thread, metal }: Look): DesignSpec {
  const hide = keyOf(FINISHES, finish);
  const stitch = keyOf(THREADS, thread);
  const plated = keyOf(METALS, metal);
  const { primary, gusset } = spec.panels;
  const colour = isColor(color) ? color : null;
  const paint = (current: DesignSpec["panels"]["primary"]) => ({ finish: hide ?? current.finish, color: colour ?? current.color });
  return {
    ...spec,
    panels: { ...spec.panels, primary: paint(primary), gusset: paint(gusset) },
    stitch: stitch ? { ...spec.stitch, thread: stitch } : spec.stitch,
    hardware: plated ? { ...spec.hardware, metal: plated } : spec.hardware,
  };
}

function lettered(initial: NonNullable<StudioInitial>, initials: unknown): StudioInitial {
  if (typeof initials !== "string" || !INITIALS_PATTERN.test(initials) || !cleanInitials(initials).trim()) return initial;
  const spec = designSpecSchema.safeParse(withInitials(initial.spec, initials));
  return spec.success ? { ...initial, spec: spec.data, source: `${initial.source}+${cleanInitials(initials).trim()}` } : initial;
}

async function loadProduct(slug: string, color: unknown, initials: unknown, look: Look): Promise<StudioInitial> {
  const product = await getProduct(slug);
  const spec = designSpecSchema.safeParse(product?.studioPreset ? normalizeSpec(product.studioPreset) : null);
  if (!spec.success) return null;
  const changed = designSpecSchema.safeParse(normalizeSpec(dressed(spec.data, color, look)));
  if (!changed.success) return null;
  const source = ["from", slug, isColor(color) ? color : "", ...[look.finish, look.thread, look.metal].map((value) => (typeof value === "string" ? value : ""))].join(":").replace(/:+$/, "");
  return lettered({ spec: changed.data, designId: null, source, owned: false }, initials);
}

export default async function StudioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { from, design, color, initials, finish, thread, metal } = await searchParams;
  let initial: StudioInitial = null;
  let notice: string | null = null;
  if (typeof design === "string") {
    initial = await loadDesign(design);
    if (!initial) notice = "We could not find that design. Choose a form to begin.";
  } else if (typeof from === "string") {
    initial = await loadProduct(from, color, initials, { finish, thread, metal });
    if (!initial) notice = "That piece cannot be reshaped in the studio. Choose a form to begin.";
  }
  return <Studio initial={initial} notice={notice} rates={await getStudioRates()} />;
}
