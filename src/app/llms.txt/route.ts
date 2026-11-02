import { connection } from "next/server";
import { fillTokens } from "@/lib/content/rich-text";
import { getAllTokens, getContent } from "@/lib/server/content";

export async function GET() {
  await connection();
  const [{ llms }, tokens] = await Promise.all([getContent("seo"), getAllTokens()]);
  return new Response(fillTokens(llms, tokens), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
