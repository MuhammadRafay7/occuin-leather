import { appendCutSheet } from "../bespoke/export";
import { PdfDocument, type PdfImage, type PdfPage } from "../bespoke/pdf";
import { appendPattern } from "../bespoke/production";
import { BRAND } from "../format";
import type { SheetRow } from "./rows";
import type { Sheet, SheetLine, SheetPicture } from "./sheet";
import { SHEET_VIEWS } from "./views";

export type PdfPicture = { bytes: Uint8Array; width: number; height: number };

const A4 = { width: 210, height: 297 };
const MARGIN = 14;
const INK = "#14201c";
const MUTED = "#646469";
const RULE = "#dcdcdc";
const DANGER = "#b3261e";
const TEXT_SIZE = 3.05;
const LINE_HEIGHT = 4.1;
const LABEL_WIDTH = 54;
const VALUE_X = MARGIN + LABEL_WIDTH;
const VALUE_WIDTH = A4.width - MARGIN - VALUE_X;
const SWATCH = 2.8;
const CHAR_EM = 0.53;
const COLUMNS = 3;
const GUTTER = 3;
const CELL = (A4.width - MARGIN * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
const EXACT_NOTICE = "(This PDF cannot show these exact characters. See the online sheet.)";

const TYPOGRAPHY: [RegExp, string][] = [[/[\u2018\u2019]/g, "'"], [/[\u201c\u201d]/g, '"'], [/[\u2013\u2014]/g, "-"], [/\u2026/g, "..."], [/[\r\n\t]+/g, " "]];

export function pdfText(value: string) {
  const plain = TYPOGRAPHY.reduce((text, [pattern, swap]) => text.replace(pattern, swap), value);
  return { text: plain, exact: /^[\x20-\x7e\xa0-\xff]*$/.test(plain) };
}

export function wrapText(value: string, widthMm: number, size = TEXT_SIZE) {
  const limit = Math.max(8, Math.floor(widthMm / (size * CHAR_EM)));
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(" ")) {
    let rest = word;
    while (rest.length > limit) {
      if (current) lines.push(current);
      current = "";
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    if (current && current.length + rest.length + 1 > limit) {
      lines.push(current);
      current = rest;
    } else {
      current = current ? `${current} ${rest}` : rest;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class Writer {
  page: PdfPage;
  y = MARGIN;
  pages: PdfPage[] = [];

  constructor(private pdf: PdfDocument, private reference: string) {
    this.page = this.next();
  }

  next() {
    this.page = this.pdf.addPage(A4.width, A4.height);
    this.pages.push(this.page);
    this.y = MARGIN + 4;
    return this.page;
  }

  fit(height: number) {
    if (this.y + height > A4.height - MARGIN - 4) this.next();
  }

  text(value: string, x: number, size = TEXT_SIZE, color = INK, bold = false) {
    this.page.text(pdfText(value).text, x, this.y, size, color, bold);
  }

  paragraph(value: string, color = MUTED) {
    for (const line of wrapText(pdfText(value).text, A4.width - MARGIN * 2)) {
      this.fit(LINE_HEIGHT);
      this.text(line, MARGIN, TEXT_SIZE, color);
      this.y += LINE_HEIGHT;
    }
  }

  heading(value: string) {
    this.fit(LINE_HEIGHT * 3);
    this.y += 2.4;
    this.text(value.toUpperCase(), MARGIN, 2.6, MUTED, true);
    this.y += 1.2;
    this.page.line(MARGIN, this.y, A4.width - MARGIN, this.y, INK, 0.2);
    this.y += LINE_HEIGHT - 0.4;
  }

  row(item: SheetRow) {
    const { text, exact } = pdfText(item.value);
    const shown = item.exact && !exact ? `${text} ${EXACT_NOTICE}` : text;
    const offset = item.swatch ? SWATCH + 1.4 : 0;
    const lines = wrapText(shown, VALUE_WIDTH - offset);
    const labels = wrapText(pdfText(item.label).text, LABEL_WIDTH - 3);
    const height = Math.max(lines.length, labels.length) * LINE_HEIGHT;
    this.fit(height);
    const top = this.y;
    labels.forEach((line, index) => this.page.text(line, MARGIN, top + index * LINE_HEIGHT, TEXT_SIZE, MUTED));
    if (item.swatch) this.page.rect(VALUE_X, top - SWATCH + 0.2, SWATCH, SWATCH, item.swatch, INK);
    lines.forEach((line, index) => this.page.text(line, VALUE_X + offset, top + index * LINE_HEIGHT, TEXT_SIZE, INK, Boolean(item.exact)));
    this.y += height;
    this.page.line(MARGIN, this.y - LINE_HEIGHT + 1.1, A4.width - MARGIN, this.y - LINE_HEIGHT + 1.1, RULE, 0.1);
  }

  grid(pictures: { picture: SheetPicture; image: PdfImage | null }[]) {
    for (let start = 0; start < pictures.length; start += COLUMNS) {
      this.fit(CELL + LINE_HEIGHT + 2);
      pictures.slice(start, start + COLUMNS).forEach(({ picture, image }, index) => {
        const x = MARGIN + index * (CELL + GUTTER);
        this.page.rect(x, this.y, CELL, CELL, "#f1f1f1");
        if (image) {
          const scale = Math.min(CELL / image.width, CELL / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          this.page.image(image, x + (CELL - width) / 2, this.y + (CELL - height) / 2, width, height);
        }
        this.page.text(pdfText(picture.label).text.slice(0, 50), x, this.y + CELL + 3.2, 2.6, MUTED);
      });
      this.y += CELL + LINE_HEIGHT + 2;
    }
  }

  stamp() {
    this.pages.forEach((page, index) => page.text(`${BRAND.name} manufacturer sheet ${this.reference}, page ${index + 1} of ${this.pages.length}`, MARGIN, A4.height - 7, 2.5, MUTED));
  }
}

function summary(writer: Writer, sheet: Sheet) {
  const cells: [string, string][] = [["Order", sheet.reference], ["Order date", sheet.orderDate], ["Pieces to make", String(sheet.pieces)], ["Required by", sheet.requiredBy ?? "Ask OCCUIN"]];
  writer.y = MARGIN + 6;
  writer.text(BRAND.name, MARGIN, 7, INK, true);
  writer.page.text("Manufacturer sheet", A4.width - MARGIN - 34, writer.y, 4, INK, true);
  writer.y += 4;
  writer.page.line(MARGIN, writer.y, A4.width - MARGIN, writer.y, INK, 0.3);
  writer.y += 6;
  const width = (A4.width - MARGIN * 2) / cells.length;
  cells.forEach(([label, value], index) => {
    writer.page.text(label.toUpperCase(), MARGIN + index * width, writer.y, 2.5, MUTED, true);
    writer.page.text(value, MARGIN + index * width, writer.y + 4.2, 3.3, INK, true);
  });
  writer.y += 11;
  if (sheet.stopped) {
    writer.text("This order was cancelled. Do not start or continue work.", MARGIN, 3.6, DANGER, true);
    writer.y += 6;
  }
  if (sheet.address) {
    writer.heading("Deliver to");
    for (const line of sheet.address) writer.paragraph(line, INK);
  }
}

function lineBlock(writer: Writer, line: SheetLine, index: number, images: Map<string, PdfImage>) {
  writer.fit(30);
  writer.y += 3;
  for (const part of wrapText(pdfText(`${index + 1}. ${line.title}`).text, A4.width - MARGIN * 2, 4.2)) {
    writer.text(part, MARGIN, 4.2, INK, true);
    writer.y += 5.2;
  }
  if (line.kind !== "payment") writer.paragraph(`Quantity ${line.quantity}`);
  line.notes.forEach((note) => writer.paragraph(note));
  writer.y += 1;
  const placed = (pictures: SheetPicture[]) => pictures.map((picture) => ({ picture, image: images.get(picture.fileId) ?? null }));
  writer.grid(placed(line.pictures));
  if (line.missingViews.length) writer.paragraph(`Images not ready yet: ${line.missingViews.map((key) => SHEET_VIEWS[key].label).join(", ")}.`, DANGER);
  for (const section of line.sections) {
    writer.heading(section.title);
    section.rows.forEach((item) => writer.row(item));
  }
  if (line.logos.length) {
    writer.heading("Logo files");
    writer.grid(placed(line.logos));
  }
  if (line.references.length) {
    writer.heading("Customer reference images");
    writer.grid(placed(line.references));
  }
}

export function sheetPdf(sheet: Sheet, pictures: Map<string, PdfPicture>) {
  const pdf = new PdfDocument();
  const images = new Map([...pictures].map(([id, picture]) => [id, pdf.addImage(picture.bytes, picture.width, picture.height)]));
  const writer = new Writer(pdf, sheet.reference);
  summary(writer, sheet);
  sheet.lines.forEach((line, index) => {
    if (index) writer.next();
    lineBlock(writer, line, index, images);
  });
  writer.stamp();
  for (const line of sheet.lines) {
    if (!line.bespoke) continue;
    appendCutSheet(pdf, line.bespoke.design, line.bespoke.reference);
    appendPattern(pdf, line.bespoke.design, { reference: line.bespoke.reference });
  }
  return pdf.render();
}
