import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { canViewOrder } from "@/lib/server/order-access";
import { expireUnpaidOrders, getOrder } from "@/lib/server/orders";
import { contactDetails, getSettings } from "@/lib/server/settings";
import { orderWhatsAppUrl } from "@/lib/server/whatsapp-order";
import { getDelivery } from "@/lib/server/content";
import { bespokeNote, deliveryEstimate, makingNote, orderRef, type ShippingMethod } from "@/lib/format";
import { OrderDetails } from "./order-details";
import { WhatsAppStep } from "./whatsapp-step";

export const metadata: Metadata = { title: "Order", robots: { index: false }, referrer: "same-origin" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  await expireUnpaidOrders();
  const order = await getOrder(id);
  if (!order) notFound();
  const token = typeof query.token === "string" ? query.token : undefined;
  if (!(await canViewOrder(order, token))) notFound();
  const [delivery, contact, { autoCancelDays }] = await Promise.all([getDelivery(), contactDetails(), getSettings()]);
  const awaitingWhatsApp = order.paymentMethod === "whatsapp" && order.status === "pending";

  return (
    <div className="mx-auto max-w-[1080px] px-page pb-24 pt-header">
      {awaitingWhatsApp ? (
        <WhatsAppStep
          reference={orderRef(order.number)}
          placed={query.placed === "1"}
          chatUrl={contact.whatsapp ? orderWhatsAppUrl(order, contact.whatsapp, delivery) : null}
          number={contact.whatsapp}
          storeEmail={contact.email}
          autoCancelDays={autoCancelDays}
        />
      ) : query.placed === "1" ? (
        <div role="status" className="mb-10 grid justify-items-start gap-3 border border-line bg-surface p-5">
          <p className="font-display text-2xl">Thank you for your order</p>
          <p className="text-sm text-muted">
            {order.status === "pending"
              ? "We will confirm it as soon as your payment clears."
              : `Order ${orderRef(order.number)} is confirmed. A receipt is on its way to ${order.email}.`}
          </p>
          <p className="text-sm text-muted">{order.items.some((item) => item.bespokeRequestId) ? bespokeNote(delivery) : `${makingNote(delivery)} ${deliveryEstimate(order.shippingMethod as ShippingMethod, delivery)}.`}</p>
          <Link href="/shop/leather" className="text-sm underline underline-offset-4 hover:opacity-60">Continue shopping</Link>
        </div>
      ) : null}
      <OrderDetails order={order} delivery={delivery} />
    </div>
  );
}
