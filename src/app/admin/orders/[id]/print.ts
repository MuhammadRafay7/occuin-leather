import { z } from "zod";
import { html, Html } from "@/lib/safe-html";
import { BRAND, money, orderRef, shippingLabel } from "@/lib/format";
import { getDelivery } from "@/lib/server/content";
import { STATUS_LABELS } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import { countryName } from "@/lib/validation";
import { shortDate } from "../../_lib/format";
import { listOrderRefunds } from "../../_lib/queries-orders";

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f1f1; color: #14201c; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .bar { max-width: 210mm; margin: 0 auto; padding: 12px 16px; display: flex; gap: 12px; align-items: center; justify-content: space-between; }
  .bar a, .bar button { font: inherit; color: inherit; background: #fff; border: 1px solid #14201c; padding: 6px 12px; text-decoration: none; cursor: pointer; }
  .sheet { background: #fff; max-width: 210mm; margin: 0 auto 32px; padding: 14mm; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #14201c; padding-bottom: 12px; }
  .brand { font: 24px/1.1 Georgia, "Times New Roman", serif; letter-spacing: .14em; margin: 0; }
  h1 { font-size: 16px; font-weight: 600; margin: 0; text-align: right; }
  .muted { color: #646469; }
  .right { text-align: right; }
  .meta { text-align: right; margin: 4px 0 0; }
  .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin: 20px 0; }
  h2 { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #646469; margin: 0 0 4px; }
  address { font-style: normal; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 600; text-align: left; color: #646469; border-bottom: 1px solid #14201c; padding: 6px 8px 6px 0; }
  td { border-bottom: 1px solid #dcdcdc; padding: 8px 8px 8px 0; vertical-align: top; }
  th:last-child, td:last-child { padding-right: 0; }
  tr { break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .detail { display: block; color: #646469; font-size: 12px; }
  .check { width: 28px; }
  .box { display: inline-block; width: 14px; height: 14px; border: 1px solid #14201c; }
  .totals { margin: 16px 0 0 auto; width: 280px; max-width: 100%; }
  .totals td { border: 0; padding: 2px 0; }
  .totals .grand td { border-top: 1px solid #14201c; font-weight: 600; padding-top: 6px; }
  footer { margin-top: 28px; color: #646469; font-size: 12px; }
  @media (max-width: 640px) {
    .sheet { padding: 16px; }
    .cols { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    table { font-size: 12px; }
  }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { max-width: none; margin: 0; padding: 0; }
  }
`;

function page(title: string, orderId: string, nonce: string | undefined, body: Html) {
  const document = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="/icon.svg">
<title>${title}</title>
<style>${new Html(STYLE)}</style>
</head>
<body>
<div class="bar"><a href="/admin/orders/${orderId}">Back to order</a><button type="button" id="print">Print</button></div>
<main class="sheet">${body}</main>
<script nonce="${nonce ?? ""}">document.getElementById("print").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`;
  return new Response(document.text, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const requestNonce = (request: Request) => /'nonce-([^']+)'/.exec(request.headers.get("content-security-policy") ?? "")?.[1];

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

function addressBlock(address: LoadedOrder["shippingAddress"], email: string | null) {
  if (!address) return html`<p class="muted">No address on this order.</p>`;
  return html`<address>
    ${address.name}<br>${address.line1}<br>${address.line2 ? html`${address.line2}<br>` : null}
    ${[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}<br>
    ${countryName(address.country)}${email ? html`<br>${email}` : null}
  </address>`;
}


const brandBlock = () => html`<div><p class="brand">${BRAND.name}</p><p class="muted" style="margin:4px 0 0">${BRAND.email}</p></div>`;

const lineDetail = (item: LoadedOrder["items"][number]) => html`<span class="detail">${item.detail}</span>`;

function invoiceBody(order: LoadedOrder, refundedCents: number, method: string) {
  const unpaid = order.status === "pending" || order.status === "cancelled";
  const row = (label: string, value: string) => html`<tr><td>${label}</td><td class="num">${value}</td></tr>`;
  return html`
    <header>
      ${brandBlock()}
      <div>
        <h1>${unpaid ? "Order summary, not paid" : "Invoice"}</h1>
        <p class="meta">${orderRef(order.number)}<br>${shortDate(order.createdAt)}<br>${STATUS_LABELS[order.status]}</p>
      </div>
    </header>
    <div class="cols">
      <section><h2>Bill and ship to</h2>${addressBlock(order.shippingAddress, order.email)}</section>
      <section><h2>Shipping</h2><p style="margin:0">${method}${order.trackingNumber ? html`<br>Tracking ${order.trackingNumber}` : null}</p></section>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="num">Unit</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
      <tbody>
        ${order.items.map((item) => html`<tr>
          <td>${item.name}${lineDetail(item)}</td>
          <td class="num">${money(item.unitPriceCents)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.unitPriceCents * item.quantity)}</td>
        </tr>`)}
      </tbody>
    </table>
    <table class="totals">
      <tbody>
        ${row("Subtotal", money(order.subtotalCents))}
        ${order.discountCents ? row(order.promoCode ? `Discount, ${order.promoCode}` : "Discount", `-${money(order.discountCents)}`) : null}
        ${row("Shipping", money(order.shippingCents))}
        ${order.taxCents ? row("Tax", money(order.taxCents)) : null}
        <tr class="grand"><td>Total, USD</td><td class="num">${money(order.totalCents)}</td></tr>
        ${refundedCents ? row("Refunded", `-${money(refundedCents)}`) : null}
        ${refundedCents ? row("Net paid", money(order.totalCents - refundedCents)) : null}
      </tbody>
    </table>
    <footer>Thank you for your order. ${BRAND.tagline}</footer>`;
}

function packingBody(order: LoadedOrder, method: string) {
  return html`
    <header>
      ${brandBlock()}
      <div>
        <h1>Packing slip</h1>
        <p class="meta">${orderRef(order.number)}<br>${shortDate(order.createdAt)}</p>
      </div>
    </header>
    <div class="cols">
      <section><h2>Ship to</h2>${addressBlock(order.shippingAddress, null)}</section>
      <section><h2>Shipping</h2><p style="margin:0">${method}${order.trackingNumber ? html`<br>Tracking ${order.trackingNumber}` : null}</p></section>
    </div>
    <table>
      <thead><tr><th class="check">Packed</th><th>Item</th><th class="num">Qty</th></tr></thead>
      <tbody>
        ${order.items.map((item) => html`<tr>
          <td class="check"><span class="box"></span></td>
          <td>${item.name}${lineDetail(item)}</td>
          <td class="num">${item.quantity}</td>
        </tr>`)}
      </tbody>
    </table>
    <footer>${order.items.reduce((sum, item) => sum + item.quantity, 0)} items in this parcel.</footer>`;
}

export async function printDocument(request: Request, params: Promise<{ id: string }>, kind: "invoice" | "packing") {
  await requireAdmin();
  const parsed = z.uuid().safeParse((await params).id);
  const order = parsed.success ? await getOrder(parsed.data) : null;
  if (!order) return new Response("Order not found", { status: 404 });
  const reference = orderRef(order.number);
  const method = shippingLabel(order.shippingMethod, await getDelivery());
  if (kind === "packing") return page(`Packing slip ${reference}`, order.id, requestNonce(request), packingBody(order, method));
  const refunds = await listOrderRefunds(order.id);
  const refundedCents = order.status === "refunded" ? order.totalCents : refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
  return page(`Invoice ${reference}`, order.id, requestNonce(request), invoiceBody(order, refundedCents, method));
}
