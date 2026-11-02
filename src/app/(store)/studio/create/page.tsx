import type { Metadata } from "next";
import { z } from "zod";
import { Creator } from "@/components/bespoke/creator";
import { designSchema } from "@/lib/bespoke/design";
import { getStudioRates, pageMetadata } from "@/lib/server/content";
import { getOwnerKey } from "@/lib/server/auth";
import { findSaved, findShared } from "@/lib/server/bespoke";

type Params = { design?: string | string[]; from?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { design, from } = await searchParams;
  const meta = await pageMetadata("/studio/create");
  return design || from ? { ...meta, robots: { index: false, follow: true } } : meta;
}

async function loadInitial({ design, from }: Params) {
  if (typeof design === "string" && z.uuid().safeParse(design).success) {
    const row = await findSaved(design, await getOwnerKey());
    const parsed = designSchema.safeParse(row?.design);
    if (row && parsed.success) return { design: parsed.data, id: row.id, name: row.name };
  }
  if (typeof from === "string") {
    const row = await findShared(from);
    const parsed = designSchema.safeParse(row?.design);
    if (row && parsed.success) return { design: parsed.data, id: null, name: `${row.name} copy`.slice(0, 60) };
  }
  return null;
}

export default async function CreatePage({ searchParams }: { searchParams: Promise<Params> }) {
  return <Creator initial={await loadInitial(await searchParams)} rates={await getStudioRates()} />;
}
