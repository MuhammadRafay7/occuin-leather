import { NextResponse } from "next/server";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";

export async function GET() {
  const [user, owner] = await Promise.all([getUser(), getOwnerKey()]);
  const { count } = await getCart(owner);
  return NextResponse.json({ signedIn: Boolean(user), isAdmin: user?.role === "admin", count }, { headers: { "Cache-Control": "private, no-store" } });
}
