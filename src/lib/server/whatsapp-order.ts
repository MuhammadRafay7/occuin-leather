import { whatsappChatUrl } from "../bespoke/whatsapp";
import { BRAND, money, orderRef, shippingLabel, type Delivery } from "../format";
import { countryName } from "../validation";
import { orderToken } from "./order-access";
import type { ShippingAddress } from "./schema";

const ORDER_LINK_SECONDS = 30 * 86_400;
const MAX_URL_LENGTH = 1800;
const NAME_LIMIT = 70;
const TIERS = [
  { detail: 160, items: Infinity, field: 200 },
  { detail: 80, items: Infinity, field: 200 },
  { detail: 40, items: Infinity, field: 200 },
  { detail: 0, items: Infinity, field: 200 },
  { detail: 0, items: 6, field: 200 },
  { detail: 0, items: 3, field: 120 },
  { detail: 0, items: 1, field: 60 },
  { detail: 0, items: 0, field: 40 },
];

type MessageItem = { name: string; detail: string | null; quantity: number; unitPriceCents: number };

export type MessageOrder = {
  id: string;
  number: number;
  items: MessageItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  promoCode: string | null;
  shippingMethod: string;
  shippingAddress: ShippingAddress | null;
};

type Tier = (typeof TIERS)[number];

export const privateOrderLink = (orderId: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/orders/${orderId}?token=${orderToken(orderId, ORDER_LINK_SECONDS)}`;

function clip(text: string, limit: number) {
  const characters = [...text.replace(/\s+/g, " ").trim()];
  return characters.length <= limit ? characters.join("") : `${characters.slice(0, limit - 3).join("").trimEnd()}...`;
}

function itemLine(item: MessageItem, detailLimit: number) {
  const detail = detailLimit && item.detail ? clip(item.detail, detailLimit) : "";
  return `${item.quantity} x ${clip(item.name, NAME_LIMIT)}${detail ? ` (${detail})` : ""}, ${money(item.unitPriceCents * item.quantity)}`;
}

function itemLines(items: MessageItem[], tier: Tier) {
  const shown = items.slice(0, tier.items).map((item) => itemLine(item, tier.detail));
  const hidden = items.length - shown.length;
  if (!hidden) return shown;
  return [...shown, shown.length ? `and ${hidden} more, see the order link` : `${hidden} ${hidden === 1 ? "item" : "items"}, see the order link`];
}

function customerLines(order: MessageOrder, delivery: Delivery, limit: number) {
  const address = order.shippingAddress;
  if (!address) return [`Delivery: ${shippingLabel(order.shippingMethod, delivery)}`];
  const place = [address.line1, address.line2, address.city, address.state, address.postalCode, countryName(address.country)].filter(Boolean).join(", ");
  return [
    `Name: ${clip(address.name, limit)}`,
    ...(address.phone ? [`Phone: ${address.phone}`] : []),
    `Deliver to: ${clip(place, limit)}`,
    `Delivery: ${shippingLabel(order.shippingMethod, delivery)}`,
  ];
}

function totalLines(order: MessageOrder) {
  return [
    `Subtotal: ${money(order.subtotalCents)}`,
    ...(order.discountCents ? [`Discount${order.promoCode ? ` (${order.promoCode})` : ""}: -${money(order.discountCents)}`] : []),
    `Shipping: ${order.shippingCents ? money(order.shippingCents) : "Free"}`,
    ...(order.taxCents ? [`Tax: ${money(order.taxCents)}`] : []),
    `Total: ${money(order.totalCents)}`,
  ];
}

const opening = (order: MessageOrder) => `Hello ${BRAND.name}, I would like to arrange payment for my order ${orderRef(order.number)}.`;

function fullMessage(order: MessageOrder, delivery: Delivery, link: string, tier: Tier) {
  return [opening(order), itemLines(order.items, tier).join("\n"), totalLines(order).join("\n"), customerLines(order, delivery, tier.field).join("\n"), `Order link: ${link}`].join("\n\n");
}

const shortestMessage = (order: MessageOrder, link: string) => [opening(order), `Total: ${money(order.totalCents)}`, `Order link: ${link}`].join("\n\n");

export function orderWhatsAppUrl(order: MessageOrder, number: string, delivery: Delivery, link = privateOrderLink(order.id)) {
  for (const tier of TIERS) {
    const url = whatsappChatUrl(number, fullMessage(order, delivery, link, tier));
    if (url.length <= MAX_URL_LENGTH) return url;
  }
  return whatsappChatUrl(number, shortestMessage(order, link));
}
