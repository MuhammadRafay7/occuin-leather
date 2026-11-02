import type { ShippingAddress } from "../server/schema";
import { orderRef } from "../format";
import type { DesignSpec } from "../studio/spec";
import { countryName } from "../validation";
import { bespokeSections } from "./bespoke-rows";
import { productSections } from "./product-rows";
import { row, type SheetSection } from "./rows";
import type { BespokeSnapshot, ProductSnapshot } from "./snapshot";
import { studioSections } from "./studio-rows";
import { isSheetView, SHEET_VIEW_KEYS, SHEET_VIEWS, type SheetView } from "./views";

export type SheetFile = { id: string; orderItemId: string; kind: string; slot: string; label: string; contentType: string; width: number | null; height: number | null };
export type SheetPicture = { fileId: string; label: string; download?: boolean };
export type SheetDownload = { label: string; path: string };
export type SheetLineKind = "studio" | "bespoke" | "product" | "payment" | "unknown";

export type SheetLine = {
  id: string;
  kind: SheetLineKind;
  title: string;
  quantity: number;
  sections: SheetSection[];
  pictures: SheetPicture[];
  logos: SheetPicture[];
  references: SheetPicture[];
  missingViews: SheetView[];
  downloads: SheetDownload[];
  notes: string[];
  bespoke: BespokeSnapshot | null;
};

export type Sheet = {
  orderId: string;
  reference: string;
  orderDate: string;
  requiredBy: string | null;
  makingDays: number | null;
  pieces: number;
  stopped: boolean;
  address: string[] | null;
  lines: SheetLine[];
};

export type SheetItem = {
  id: string;
  name: string;
  quantity: number;
  designSpec: DesignSpec | null;
  productSnapshot: ProductSnapshot | null;
  bespokeSnapshot: BespokeSnapshot | null;
  bespokePart: string | null;
};

export type SheetOrder = {
  id: string;
  number: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  makingDays: number | null;
  shippingAddress: ShippingAddress | null;
  items: SheetItem[];
};

const DAY_MS = 86_400_000;
const STOPPED = new Set(["cancelled", "refunded"]);
const sheetDate = (date: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);

export const requiredByDate = (start: Date, makingDays: number) => new Date(start.getTime() + makingDays * DAY_MS);
export const lineNeedsViews = (item: SheetItem) => Boolean(item.designSpec || (item.bespokeSnapshot && item.bespokePart !== "balance"));

function addressLines(address: ShippingAddress) {
  return [address.name, address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(", "), countryName(address.country)].filter((line): line is string => Boolean(line));
}

const lineKind = (item: SheetItem): SheetLineKind => {
  if (item.bespokePart === "balance") return "payment";
  if (item.designSpec) return "studio";
  if (item.bespokeSnapshot) return "bespoke";
  if (item.productSnapshot) return "product";
  return "unknown";
};

function sectionsOf(item: SheetItem, kind: SheetLineKind): SheetSection[] {
  if (kind === "studio") return studioSections(item.designSpec!);
  if (kind === "bespoke") return bespokeSections(item.bespokeSnapshot!);
  if (kind === "product") return productSections(item.productSnapshot!);
  if (kind === "unknown") return [{ title: "Item", rows: [row("Item", item.name), row("Details", "This order line has no stored details. Ask OCCUIN before starting.")] }];
  return [];
}

function lineNotes(item: SheetItem, kind: SheetLineKind) {
  const notes: string[] = [];
  if (kind === "payment") notes.push("This line is a balance payment for a bespoke piece. Nothing to make here, the piece is on the original order.");
  if (kind === "bespoke") notes.push("A piece designed from scratch can take longer. OCCUIN confirms the timing.");
  const late = item.productSnapshot?.frozenLate || item.bespokeSnapshot?.frozenLate;
  if (late) notes.push("These details were copied after this order was placed. Check them against the order if it is an older one.");
  return notes;
}

function lineOf(item: SheetItem, files: SheetFile[]): SheetLine {
  const kind = lineKind(item);
  const mine = files.filter((file) => file.orderItemId === item.id);
  const picture = (file: SheetFile): SheetPicture => ({ fileId: file.id, label: file.label || file.slot });
  const views = mine.filter((file) => file.kind === "view" && isSheetView(file.slot));
  const ordered = SHEET_VIEW_KEYS.flatMap((key) => views.filter((file) => file.slot === key).map((file) => ({ fileId: file.id, label: SHEET_VIEWS[key].label })));
  const photos = mine.filter((file) => file.kind === "photo").sort((a, b) => Number(a.slot) - Number(b.slot)).map(picture);
  const needsViews = kind === "studio" || kind === "bespoke";
  return {
    id: item.id,
    kind,
    title: item.name,
    quantity: item.quantity,
    sections: sectionsOf(item, kind),
    pictures: needsViews ? ordered : kind === "product" ? photos : [],
    logos: mine.filter((file) => file.kind === "logo").map((file) => ({ ...picture(file), download: true })),
    references: mine.filter((file) => file.kind === "reference").sort((a, b) => Number(a.slot) - Number(b.slot)).map(picture),
    missingViews: needsViews ? SHEET_VIEW_KEYS.filter((key) => !views.some((file) => file.slot === key)) : [],
    downloads: kind === "bespoke" ? [{ label: "Cut sheet, PDF", path: `cut-sheet/${item.id}` }, { label: "Draft pattern, PDF", path: `pattern/${item.id}` }] : [],
    notes: lineNotes(item, kind),
    bespoke: kind === "bespoke" ? item.bespokeSnapshot : null,
  };
}

export function buildSheet(order: SheetOrder, files: SheetFile[], options: { includeAddress: boolean }): Sheet {
  const lines = order.items.map((item) => lineOf(item, files));
  const start = order.paidAt ?? order.createdAt;
  return {
    orderId: order.id,
    reference: orderRef(order.number),
    orderDate: sheetDate(order.createdAt),
    requiredBy: order.makingDays === null ? null : sheetDate(requiredByDate(start, order.makingDays)),
    makingDays: order.makingDays,
    pieces: lines.reduce((sum, line) => sum + (line.kind === "payment" ? 0 : line.quantity), 0),
    stopped: STOPPED.has(order.status),
    address: options.includeAddress && order.shippingAddress ? addressLines(order.shippingAddress) : null,
    lines,
  };
}
