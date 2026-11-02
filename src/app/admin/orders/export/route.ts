import type { NextRequest } from "next/server";
import { orderRef } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/order-status";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { csvMoney, csvResponse } from "../../_lib/csv";
import { dayKey } from "../../_lib/report-range";
import { exportFilteredOrders, parseOrderFilters } from "../../_lib/queries-orders";

const HEAD = ["reference", "placed_utc", "status", "email", "customer", "country", "shipping_method", "subtotal_usd", "discount_usd", "shipping_usd", "tax_usd", "total_usd", "refunded_usd", "net_usd", "payment", "promo_code", "tracking_number"];

export async function GET(request: NextRequest) {
  const actor = await requireAdmin();
  const orders = await exportFilteredOrders(parseOrderFilters(Object.fromEntries(request.nextUrl.searchParams)));
  const rows = orders.map((order) => [
    orderRef(order.number),
    order.createdAt.toISOString(),
    STATUS_LABELS[order.status],
    order.email,
    order.customerName,
    order.country,
    order.shippingMethod,
    csvMoney(order.subtotalCents),
    csvMoney(order.discountCents),
    csvMoney(order.shippingCents),
    csvMoney(order.taxCents),
    csvMoney(order.totalCents),
    csvMoney(order.refundedCents),
    csvMoney(order.totalCents - order.refundedCents),
    order.paymentMethod,
    order.promoCode,
    order.trackingNumber,
  ]);
  await recordAudit(actor, { action: "order.export", targetType: "order", detail: `${rows.length} rows` });
  return csvResponse(`occuin-orders-${dayKey(new Date())}.csv`, HEAD, rows);
}
