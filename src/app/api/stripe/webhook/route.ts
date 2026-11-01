import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { markPaid, moveOrder, stripe } from "@/lib/server/orders";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return new Response("Not configured", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const fresh = await db.insert(schema.stripeEvents).values({ id: event.id }).onConflictDoNothing().returning();
  if (!fresh.length) return Response.json({ received: true });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object;
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.stripeSessionId, session.id));
    if (order && event.type === "checkout.session.completed") {
      await markPaid(order.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
    }
    if (order && event.type === "checkout.session.expired") await moveOrder(order.id, "cancelled", { note: "Payment session expired" });
  }
  return Response.json({ received: true });
}
