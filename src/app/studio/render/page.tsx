import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderView } from "@/components/studio/render-view";
import { PRESETS, type PresetKey } from "@/lib/studio/presets";

export const metadata: Metadata = { title: "Studio render", robots: { index: false, follow: false } };

export default async function StudioRenderPage({ searchParams }: { searchParams: Promise<{ preset?: string | string[] }> }) {
  const { preset } = await searchParams;
  if (typeof preset !== "string" || !Object.hasOwn(PRESETS, preset)) notFound();
  return <RenderView spec={PRESETS[preset as PresetKey]} />;
}
