"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getOwnerKey, hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { orderToken } from "@/lib/server/order-access";
import { getSettings, pausedMessage, paymentModeOf } from "@/lib/server/settings";
import { findOrderByRef, placeOrder, type CheckoutResult } from "@/lib/server/orders";
import { SHIPPING_METHODS, type ShippingMethod } from "@/lib/format";
import { fieldErrors, textValues, type FormState } from "@/lib/form-state";
import { addressInput, addressSchema, emailField, phoneField } from "@/lib/validation";
import { refreshStore } from "@/lib/server/store-cache";

const TOO_MANY = "Too many attempts. Try again in a few minutes.";
const NOT_FOUND = "We could not find an order with those details.";
const NOT_PLACED = "We could not place your order. You have not been charged. Please try again.";
const WHATSAPP_ORDERS_PER_DAY = 20;

const contactSchema = z.object({
  email: emailField,
  method: z.enum(Object.keys(SHIPPING_METHODS) as [ShippingMethod, ...ShippingMethod[]], "Choose a shipping method."),
});
const trackSchema = z.object({
  ref: z.string().trim().regex(/^O[CR]-?\d{1,9}$/i, "Enter a reference like OC-000123."),
  email: emailField,
});

export async function submitCheckout(_: FormState, data: FormData): Promise<FormState> {
  const owner = await getOwnerKey();
  if (!owner) redirect("/bag");

  const settings = await getSettings().catch(() => null);
  if (!settings) return { error: NOT_PLACED };
  const payment = paymentModeOf(settings);
  const whatsapp = payment === "whatsapp";

  const contact = contactSchema.safeParse({ email: data.get("email"), method: data.get("method") });
  const address = addressSchema.safeParse(addressInput(data));
  const phone = whatsapp ? phoneField.safeParse(data.get("phone")) : null;
  if (!contact.success || !address.success || phone?.success === false) {
    return {
      error: "Check the marked fields.",
      fields: {
        ...(contact.success ? {} : fieldErrors(contact.error)),
        ...(address.success ? {} : fieldErrors(address.error)),
        ...(phone?.success === false ? { phone: phone.error.issues[0]?.message ?? "Enter your phone number." } : {}),
      },
    };
  }

  const ip = await clientIp();
  const [ownerLimited, ipLimited, dailyLimited] = await Promise.all([
    hitRateLimit(`checkout:owner:${owner}`, 10, 600),
    hitRateLimit(`checkout:ip:${ip}`, 30, 600),
    whatsapp ? hitRateLimit(`checkout:whatsapp:ip:${ip}`, WHATSAPP_ORDERS_PER_DAY, 86_400) : false,
  ]);
  if (ownerLimited || ipLimited || dailyLimited) return { error: TOO_MANY };

  let result: CheckoutResult;
  try {
    const paused = pausedMessage(settings);
    if (paused) return { error: paused };
    result = await placeOrder({
      ownerKey: owner,
      email: contact.data.email,
      address: phone?.data ? { ...address.data, phone: phone.data } : address.data,
      method: contact.data.method,
      rates: settings,
      payment,
    });
  } catch (error) {
    console.error("[checkout] order failed", error);
    return { error: NOT_PLACED };
  }
  if ("error" in result) {
    if (result.error === "Your bag is empty.") redirect("/bag");
    return { error: result.error };
  }

  refreshStore();
  redirect(result.redirectUrl);
}

export async function trackOrder(_: FormState, data: FormData): Promise<FormState> {
  const values = textValues(data);
  const parsed = trackSchema.safeParse({ ref: data.get("ref"), email: data.get("email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const number = Number(parsed.data.ref.replace(/\D/g, ""));
  const [ipLimited, refLimited] = await Promise.all([
    hitRateLimit(`track:ip:${await clientIp()}`, 10, 900),
    hitRateLimit(`track:ref:${number}`, 10, 900),
  ]);
  if (ipLimited || refLimited) return { error: TOO_MANY, values };

  const order = await findOrderByRef(number, parsed.data.email);
  if (!order) return { error: NOT_FOUND, values };
  redirect(`/orders/${order.id}?token=${orderToken(order.id)}`);
}
