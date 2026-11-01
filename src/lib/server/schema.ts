import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { DesignSpec } from "../studio/spec";
import type { DesignQuote } from "../studio/pricing";
import { ORDER_STATUSES } from "../order-status";
import type { BespokeDesign } from "../bespoke/design";
import { DEPOSIT_PERCENT } from "../bespoke/config";
import { BESPOKE_STATUSES } from "../bespoke/status";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["customer", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const departmentEnum = pgEnum("department", ["women", "men", "leather"]);
export const bespokeStatusEnum = pgEnum("bespoke_status", BESPOKE_STATUSES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("customer"),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  department: departmentEnum("department").notNull(),
  position: integer("position").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    composition: text("composition").notNull(),
    categorySlug: text("category_slug").notNull().references(() => categories.slug),
    images: text("images").array().notNull(),
    audiences: text("audiences").array().notNull().default(sql`array['women', 'men']`),
    studioPreset: jsonb("studio_preset").$type<DesignSpec>(),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("products_category_idx").on(t.categorySlug)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    color: text("color").notNull(),
    size: text("size").notNull(),
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull().default(0),
  },
  (t) => [
    check("variants_stock_non_negative", sql`${t.stock} >= 0`),
    check("variants_price_positive", sql`${t.priceCents} > 0`),
    index("variants_product_idx").on(t.productId),
  ],
);

export const designs = pgTable(
  "designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerKey: text("owner_key").notNull(),
    name: text("name").notNull(),
    spec: jsonb("spec").$type<DesignSpec>().notNull(),
    priceCents: integer("price_cents").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("designs_owner_idx").on(t.ownerKey)],
);

export const designPreviews = pgTable(
  "design_previews",
  {
    designId: uuid("design_id").notNull().references(() => designs.id, { onDelete: "cascade" }),
    view: text("view").notNull(),
    webp: bytea("webp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.designId, t.view] })],
);

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerKey: text("owner_key").notNull().unique(),
  promoCode: text("promo_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "cascade" }),
    designId: uuid("design_id").references(() => designs.id, { onDelete: "cascade" }),
    bespokeRequestId: uuid("bespoke_request_id").references(() => bespokeRequests.id, { onDelete: "cascade" }),
    bespokePart: text("bespoke_part"),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    check("cart_items_one_target", sql`num_nonnulls(${t.variantId}, ${t.designId}, ${t.bespokeRequestId}) = 1`),
    check("cart_items_quantity", sql`${t.quantity} between 1 and 10`),
    uniqueIndex("cart_items_variant_unique").on(t.cartId, t.variantId),
    uniqueIndex("cart_items_design_unique").on(t.cartId, t.designId),
    uniqueIndex("cart_items_bespoke_unique").on(t.cartId, t.bespokeRequestId, t.bespokePart),
  ],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    ownerKey: text("owner_key").notNull(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerKey, t.productId] })],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    ownerKey: text("owner_key").notNull(),
    email: text("email"),
    status: orderStatusEnum("status").notNull().default("pending"),
    currency: text("currency").notNull().default("usd"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    shippingMethod: text("shipping_method").notNull().default("standard"),
    promoCode: text("promo_code"),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
    trackingNumber: text("tracking_number"),
    createdAt: createdAt(),
  },
  (t) => [index("orders_owner_idx").on(t.ownerKey), index("orders_status_idx").on(t.status)],
);

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    designId: uuid("design_id").references(() => designs.id, { onDelete: "set null" }),
    bespokeRequestId: uuid("bespoke_request_id").references(() => bespokeRequests.id, { onDelete: "set null" }),
    bespokePart: text("bespoke_part"),
    name: text("name").notNull(),
    detail: text("detail").notNull(),
    image: text("image"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    designSpec: jsonb("design_spec").$type<DesignSpec>(),
    designPrice: jsonb("design_price").$type<DesignQuote>(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    address: jsonb("address").$type<ShippingAddress>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const promoCodes = pgTable("promo_codes", {
  code: text("code").primaryKey(),
  percentOff: integer("percent_off").notNull(),
  minSubtotalCents: integer("min_subtotal_cents").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  timesUsed: integer("times_used").notNull().default(0),
  maxUses: integer("max_uses"),
  oncePerCustomer: boolean("once_per_customer").notNull().default(false),
  createdAt: createdAt(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("reviews_rating", sql`${t.rating} between 1 and 5`),
    uniqueIndex("reviews_one_per_user").on(t.productId, t.userId),
  ],
);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  email: text("email").primaryKey(),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: createdAt(),
});

export const bespokeRequests = pgTable(
  "bespoke_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    status: bespokeStatusEnum("status").notNull().default("new"),
    ownerKey: text("owner_key"),
    acceptedOwnerKey: text("accepted_owner_key"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    depositPercent: integer("deposit_percent").notNull().default(DEPOSIT_PERCENT),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
    balanceRequestedAt: timestamp("balance_requested_at", { withTimezone: true }),
    balancePaidAt: timestamp("balance_paid_at", { withTimezone: true }),
    balanceOrderId: uuid("balance_order_id").references(() => orders.id, { onDelete: "set null" }),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    quoteExpiresAt: timestamp("quote_expires_at", { withTimezone: true }),
    quoteEmailedAt: timestamp("quote_emailed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    changeMessage: text("change_message"),
    changeRequestedAt: timestamp("change_requested_at", { withTimezone: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    country: text("country").notNull(),
    phone: text("phone"),
    productType: text("product_type").notNull(),
    notes: text("notes").notNull().default(""),
    design: jsonb("design").$type<BespokeDesign>().notNull(),
    estimateLowCents: integer("estimate_low_cents").notNull(),
    estimateHighCents: integer("estimate_high_cents").notNull(),
    quotedPriceCents: integer("quoted_price_cents"),
    adminNote: text("admin_note").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bespoke_estimate_order", sql`${t.estimateLowCents} > 0 and ${t.estimateHighCents} >= ${t.estimateLowCents}`),
    check("bespoke_quote_positive", sql`${t.quotedPriceCents} is null or ${t.quotedPriceCents} > 0`),
    check("bespoke_deposit_percent", sql`${t.depositPercent} between 1 and 100`),
    index("bespoke_requests_status_idx").on(t.status),
    index("bespoke_requests_owner_idx").on(t.ownerKey),
  ],
);

export const bespokeRequestImages = pgTable(
  "bespoke_request_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => bespokeRequests.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    contentType: text("content_type").notNull(),
    filename: text("filename").notNull(),
    byteSize: integer("byte_size").notNull(),
    bytes: bytea("bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("bespoke_image_size", sql`${t.byteSize} between 1 and 4194304`),
    uniqueIndex("bespoke_image_position").on(t.requestId, t.position),
  ],
);

export const bespokeTokens = pgTable(
  "bespoke_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    requestId: uuid("request_id").notNull().references(() => bespokeRequests.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '90 days'`),
  },
  (t) => [index("bespoke_tokens_request_idx").on(t.requestId)],
);

export const bespokeDesigns = pgTable(
  "bespoke_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerKey: text("owner_key").notNull(),
    name: text("name").notNull(),
    design: jsonb("design").$type<BespokeDesign>().notNull(),
    shareTokenHash: text("share_token_hash").unique(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bespoke_designs_owner_idx").on(t.ownerKey)],
);

export const bespokeLogos = pgTable(
  "bespoke_logos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerKey: text("owner_key").notNull(),
    filename: text("filename").notNull(),
    rightsConfirmedAt: timestamp("rights_confirmed_at", { withTimezone: true }).notNull(),
    png: bytea("png").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("bespoke_logos_owner_idx").on(t.ownerKey)],
);

export const bespokeMessages = pgTable(
  "bespoke_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => bespokeRequests.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("bespoke_message_author", sql`${t.author} in ('customer', 'team')`), index("bespoke_messages_request_idx").on(t.requestId)],
);
