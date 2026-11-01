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

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["customer", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const departmentEnum = pgEnum("department", ["women", "men", "leather"]);

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
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    check("cart_items_one_target", sql`num_nonnulls(${t.variantId}, ${t.designId}) = 1`),
    check("cart_items_quantity", sql`${t.quantity} between 1 and 10`),
    uniqueIndex("cart_items_variant_unique").on(t.cartId, t.variantId),
    uniqueIndex("cart_items_design_unique").on(t.cartId, t.designId),
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
