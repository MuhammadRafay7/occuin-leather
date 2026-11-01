import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, schema } from "@/lib/server/db";
import { cancelCheckoutSession, settleCheckoutSession, stripe } from "@/lib/server/orders";

async function handle(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    if (event.data.object.payment_status === "paid") await settleCheckoutSession(event.data.object);
  }
  if (event.type === "checkout.session.async_payment_succeeded") await settleCheckoutSession(event.data.object);
  if (event.type === "checkout.session.async_payment_failed") await cancelCheckoutSession(event.data.object, "Payment failed");
  if (event.type === "checkout.session.expired") await cancelCheckoutSession(event.data.object, "Payment session expired");
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return new Response("Not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const [seen] = await db.select({ id: schema.stripeEvents.id }).from(schema.stripeEvents).where(eq(schema.stripeEvents.id, event.id));
  if (seen) return Response.json({ received: true });

  try {
    await handle(event);
  } catch (error) {
    console.error(`[stripe] ${event.id} failed`, error);
    return new Response("Try again", { status: 500 });
  }
  await db.insert(schema.stripeEvents).values({ id: event.id }).onConflictDoNothing();
  return Response.json({ received: true });
}
