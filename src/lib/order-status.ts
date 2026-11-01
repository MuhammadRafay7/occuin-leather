export const ORDER_STATUSES = [
  "pending",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["in_production", "shipped", "refunded"],
  in_production: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Confirmed",
  in_production: "In the atelier",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

export const nextStatuses = (from: OrderStatus) => TRANSITIONS[from];

export const stockIsHeld = (status: OrderStatus) => status === "pending" || status === "paid" || status === "in_production";
