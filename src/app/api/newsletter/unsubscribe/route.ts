import { NextResponse, type NextRequest } from "next/server";
import { removeSubscriber, verifyUnsubscribe } from "@/lib/server/unsubscribe";

const readLink = (request: NextRequest) => ({ email: request.nextUrl.searchParams.get("email") ?? "", token: request.nextUrl.searchParams.get("token") ?? "" });

export async function POST(request: NextRequest) {
  const { email, token } = readLink(request);
  if (!email || !verifyUnsubscribe(email, token)) return new Response("Invalid link", { status: 400 });
  await removeSubscriber(email);
  return new Response("Unsubscribed", { status: 200 });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/unsubscribe";
  return NextResponse.redirect(url);
}
