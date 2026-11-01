import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { z } from "zod";
import { Studio, type StudioInitial } from "@/components/studio/studio";
import { pageMeta } from "@/lib/seo";
import { getOwnerKey } from "@/lib/server/auth";
import { getProduct } from "@/lib/server/catalog";
import { db, schema } from "@/lib/server/db";
import { COLORS, designSpecSchema, normalizeSpec, type ColorKey } from "@/lib/studio/spec";

type Params = { from?: string | string[]; design?: string | string[]; color?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { design } = await searchParams;
  return design ? { ...pageMeta("/studio"), robots: { index: false, follow: true } } : pageMeta("/studio");
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

async function loadProduct(slug: string, color: unknown): Promise<StudioInitial> {
  const product = await getProduct(slug);
  const spec = designSpecSchema.safeParse(product?.studioPreset ? normalizeSpec(product.studioPreset) : null);
  if (!spec.success) return null;
  if (!isColor(color)) return { spec: spec.data, designId: null, source: `from:${slug}`, owned: false };
  const { primary, gusset } = spec.data.panels;
  const panels = { ...spec.data.panels, primary: { ...primary, color }, gusset: { ...gusset, color } };
  return { spec: { ...spec.data, panels }, designId: null, source: `from:${slug}:${color}`, owned: false };
}

export default async function StudioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { from, design, color } = await searchParams;
  let initial: StudioInitial = null;
  let notice: string | null = null;
  if (typeof design === "string") {
    initial = await loadDesign(design);
    if (!initial) notice = "We could not find that design. Choose a form to begin.";
  } else if (typeof from === "string") {
    initial = await loadProduct(from, color);
    if (!initial) notice = "That piece cannot be reshaped in the studio. Choose a form to begin.";
  }
  return <Studio initial={initial} notice={notice} />;
}
