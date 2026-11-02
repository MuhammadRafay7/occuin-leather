type Entry = { action: string; detail: string | null };
type Rule = { label: string; sentence?: (detail: string) => string };

const words = (text: string) => text.replaceAll("_", " ");
const rowsOf = (detail: string) => (detail.startsWith("1 ") ? "1 record" : detail.replace(/\brows?\b/, "records"));

const RULES: Record<string, Rule> = {
  "activity.export": { label: "Downloaded the change history", sentence: (d) => `Downloaded the change history (${rowsOf(d)})` },
  "bespoke.balance_paid": { label: "Marked a bespoke balance as paid" },
  "bespoke.balance_request": { label: "Asked for a bespoke balance", sentence: (d) => `Asked for a bespoke balance (${d.toLowerCase()})` },
  "bespoke.quote_resend": { label: "Sent a bespoke quote again" },
  "bespoke.reply": { label: "Replied on a bespoke request", sentence: (d) => `Replied on a bespoke request (${d.toLowerCase()})` },
  "bespoke.update": { label: "Updated a bespoke request", sentence: (d) => `Updated a bespoke request: ${words(d).replace(/quote (\d+) cents/, (_, cents: string) => `quote $${(Number(cents) / 100).toLocaleString("en-US")}`)}` },
  "category.create": { label: "Added a category", sentence: (d) => `Added the category ${d}` },
  "category.delete": { label: "Deleted a category", sentence: (d) => `Deleted the category ${d}` },
  "category.reorder": { label: "Moved a category" },
  "category.update": { label: "Edited a category", sentence: (d) => `Edited the category ${d}` },
  "content.reset": { label: "Reset website content", sentence: (d) => `Reset ${d} to the original wording` },
  "content.save": { label: "Edited website content", sentence: (d) => `Edited ${d}` },
  "customer.block": { label: "Blocked a customer", sentence: (d) => `Blocked ${d}` },
  "customer.delete": { label: "Deleted a customer" },
  "customer.export": { label: "Downloaded the customer list", sentence: (d) => `Downloaded the customer list (${rowsOf(d)})` },
  "customer.make_admin": { label: "Gave someone admin access", sentence: (d) => `Gave ${d} admin access` },
  "customer.note": { label: "Changed a private note", sentence: (d) => (d.endsWith("cleared") ? "Cleared a private note on a customer" : "Updated a private note on a customer") },
  "customer.password_reset": { label: "Sent a password reset", sentence: (d) => `Sent a password reset to ${d}` },
  "customer.remove_admin": { label: "Removed admin access", sentence: (d) => `Removed admin access from ${d}` },
  "customer.unblock": { label: "Unblocked a customer", sentence: (d) => `Unblocked ${d}` },
  "media.delete": { label: "Deleted a photo", sentence: (d) => `Deleted the photo ${d}` },
  "media.upload": { label: "Uploaded a photo", sentence: (d) => `Uploaded the photo ${d}` },
  "message.handled": { label: "Marked a message as done" },
  "message.reopened": { label: "Reopened a message" },
  "message.reply": { label: "Replied to a message", sentence: (d) => `Replied to a message (${d.charAt(0).toLowerCase()}${d.slice(1)})` },
  "newsletter.campaign_done": { label: "A newsletter finished sending", sentence: (d) => `A newsletter finished sending: ${d}` },
  "newsletter.campaign_pause": { label: "A newsletter stopped", sentence: (d) => `A newsletter stopped: ${d}` },
  "newsletter.campaign_resume": { label: "Restarted a newsletter", sentence: (d) => `Restarted a newsletter (${d})` },
  "newsletter.campaign_start": { label: "Started a newsletter", sentence: (d) => `Started the newsletter ${d}` },
  "newsletter.export": { label: "Downloaded the subscriber list", sentence: (d) => `Downloaded the subscriber list (${rowsOf(d)})` },
  "newsletter.remove": { label: "Removed a subscriber" },
  "newsletter.test": { label: "Sent a test newsletter", sentence: (d) => `Sent a test of ${d}` },
  "order.note": { label: "Added a note to an order", sentence: (d) => `Added a note to an order: ${d}` },
  "order.resend_confirmation": { label: "Sent an order confirmation again", sentence: (d) => `Sent an order confirmation again to ${d}` },
  "order.status": { label: "Changed an order's status", sentence: (d) => `Changed an order's status to ${words(d)}` },
  "order.tracking": { label: "Changed an order's tracking", sentence: (d) => `Changed an order's tracking: ${d}` },
  "product.activate": { label: "Put a product on sale", sentence: (d) => `Put ${d} on sale` },
  "product.create": { label: "Added a product", sentence: (d) => `Added the product ${d}` },
  "product.deactivate": { label: "Took a product off sale", sentence: (d) => `Took ${d} off sale` },
  "product.duplicate": { label: "Copied a product" },
  "product.import": { label: "Imported products", sentence: (d) => `Imported products: ${d}` },
  "product.update": { label: "Edited a product", sentence: (d) => `Edited the product ${d}` },
  "promo.activate": { label: "Turned on a discount code" },
  "promo.create": { label: "Added a discount code", sentence: (d) => `Added a discount code for ${d}` },
  "promo.deactivate": { label: "Turned off a discount code" },
  "promo.delete": { label: "Deleted a discount code" },
  "promo.update": { label: "Edited a discount code" },
  "review.delete": { label: "Deleted a review" },
  "review.hide": { label: "Hid a review" },
  "review.reply": { label: "Replied to a review", sentence: (d) => `Replied to a review: ${d}` },
  "review.reply_remove": { label: "Removed a review reply" },
  "review.unhide": { label: "Showed a hidden review" },
  "settings.update": { label: "Changed store settings" },
  "stock.adjust": { label: "Adjusted stock", sentence: (d) => `Adjusted stock: ${d}` },
  "stock.bulk": { label: "Adjusted stock for several items", sentence: (d) => `Adjusted stock: ${d}` },
  "stock.set": { label: "Set a stock count", sentence: (d) => `Set stock for ${d}` },
};

function ruleFor(action: string): Rule {
  if (RULES[action]) return RULES[action];
  if (action.endsWith(".export")) {
    const area = action.split(".")[0];
    return { label: `Downloaded the ${area} list`, sentence: (d) => `Downloaded the ${area} list (${rowsOf(d)})` };
  }
  if (action.startsWith("order.refund")) return { label: "Recorded a refund", sentence: (d) => `Recorded a refund: ${d}` };
  if (action.startsWith("product.bulk")) return { label: "Changed several products at once", sentence: (d) => `Changed several products at once: ${d}` };
  const plain = words(action.replaceAll(".", " "));
  const label = plain.charAt(0).toUpperCase() + plain.slice(1);
  return { label, sentence: (d) => `${label}: ${d}` };
}

export const actionLabel = (action: string) => ruleFor(action).label;

export function sentenceFor({ action, detail }: Entry) {
  const rule = ruleFor(action);
  const text = detail?.trim();
  return text && rule.sentence ? rule.sentence(text) : rule.label;
}

export const AREA_LABELS: Record<string, string> = {
  activity: "Change history",
  bespoke: "Bespoke",
  campaign: "Newsletters",
  category: "Categories",
  content: "Website content",
  customer: "Customers",
  media: "Photos",
  message: "Messages",
  order: "Orders",
  product: "Products",
  promo: "Discount codes",
  review: "Reviews",
  settings: "Settings",
  subscriber: "Subscribers",
  variant: "Stock",
};
