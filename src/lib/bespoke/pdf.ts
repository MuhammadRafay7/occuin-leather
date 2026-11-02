const PT_PER_MM = 72 / 25.4;
const BINARY_CHUNK = 8192;

type Page = { width: number; height: number; ops: string[]; images: Set<number> };
export type PdfImage = { index: number; width: number; height: number };
type StoredImage = PdfImage & { bytes: Uint8Array };

const fixed = (value: number) => value.toFixed(3).replace(/\.?0+$/, "") || "0";
const latin = (text: string) => text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?").replace(/([\\()])/g, "\\$1");

function hexRgb(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((start) => fixed(parseInt(value.slice(start, start + 2), 16) / 255)).join(" ");
}

function binaryText(bytes: Uint8Array) {
  let text = "";
  for (let start = 0; start < bytes.length; start += BINARY_CHUNK) text += String.fromCharCode(...bytes.subarray(start, start + BINARY_CHUNK));
  return text;
}

export class PdfPage {
  constructor(private page: Page) {}

  private x = (mm: number) => fixed(mm * PT_PER_MM);
  private y = (mm: number) => fixed(this.page.height - mm * PT_PER_MM);

  private path(subpaths: PdfSubpath[]) {
    for (const { start, curves, closed } of subpaths) {
      this.page.ops.push(`${this.x(start.x)} ${this.y(start.y)} m`);
      for (const curve of curves) {
        this.page.ops.push(`${this.x(curve.c1.x)} ${this.y(curve.c1.y)} ${this.x(curve.c2.x)} ${this.y(curve.c2.y)} ${this.x(curve.b.x)} ${this.y(curve.b.y)} c`);
      }
      if (closed) this.page.ops.push("h");
    }
  }

  shape(subpaths: PdfSubpath[], { fill, stroke, width = 0.3, dash }: { fill?: string; stroke?: string; width?: number; dash?: [number, number] }) {
    const ops = this.page.ops;
    ops.push("q");
    if (fill) ops.push(`${hexRgb(fill)} rg`);
    if (stroke) ops.push(`${hexRgb(stroke)} RG`, `${fixed(width * PT_PER_MM)} w`);
    if (dash) ops.push(`[${fixed(dash[0] * PT_PER_MM)} ${fixed(dash[1] * PT_PER_MM)}] 0 d`);
    this.path(subpaths);
    ops.push(fill && stroke ? "B*" : fill ? "f*" : "S", "Q");
  }

  rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string) {
    const corner = (cx: number, cy: number) => ({ x: cx, y: cy });
    const points = [corner(x + width, y), corner(x + width, y + height), corner(x, y + height)];
    const curves = points.map((point) => ({ c1: point, c2: point, b: point }));
    this.shape([{ start: corner(x, y), curves, closed: true }], { fill, ...(stroke ? { stroke, width: 0.1 } : {}) });
  }

  image(image: PdfImage, x: number, y: number, width: number, height: number) {
    this.page.images.add(image.index);
    this.page.ops.push("q", `${fixed(width * PT_PER_MM)} 0 0 ${fixed(height * PT_PER_MM)} ${this.x(x)} ${this.y(y + height)} cm`, `/Im${image.index} Do`, "Q");
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "#14201c", width = 0.3) {
    this.page.ops.push("q", `${hexRgb(color)} RG`, `${fixed(width * PT_PER_MM)} w`, `${this.x(x1)} ${this.y(y1)} m`, `${this.x(x2)} ${this.y(y2)} l`, "S", "Q");
  }

  text(value: string, x: number, y: number, sizeMm = 3.6, color = "#14201c", bold = false) {
    this.page.ops.push("q", `${hexRgb(color)} rg`, "BT", `/${bold ? "F2" : "F1"} ${fixed(sizeMm * PT_PER_MM)} Tf`, `${this.x(x)} ${this.y(y)} Td`, `(${latin(value)}) Tj`, "ET", "Q");
  }
}

export type PdfSubpath = { start: { x: number; y: number }; curves: { c1: { x: number; y: number }; c2: { x: number; y: number }; b: { x: number; y: number } }[]; closed: boolean };

export class PdfDocument {
  private pages: Page[] = [];
  private images: StoredImage[] = [];

  addPage(widthMm: number, heightMm: number) {
    const page: Page = { width: widthMm * PT_PER_MM, height: heightMm * PT_PER_MM, ops: [], images: new Set() };
    this.pages.push(page);
    return new PdfPage(page);
  }

  addImage(jpeg: Uint8Array, width: number, height: number): PdfImage {
    const image = { index: this.images.length, width, height, bytes: jpeg };
    this.images.push(image);
    return image;
  }

  render() {
    const objects: string[] = [];
    const kids = this.pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const firstImageId = 5 + this.pages.length * 2;
    this.pages.forEach((page, index) => {
      const pageId = 5 + index * 2;
      const pictures = [...page.images].map((image) => `/Im${image} ${firstImageId + image} 0 R`).join(" ");
      const content = page.ops.join("\n");
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(page.width)} ${fixed(page.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${pictures ? ` /XObject << ${pictures} >>` : ""} >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });
    this.images.forEach((image, index) => {
      objects[firstImageId + index] = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n${binaryText(image.bytes)}\nendstream`;
    });
    let output = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = output.length;
      output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = output.length;
    output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(output.length);
    for (let index = 0; index < output.length; index++) bytes[index] = output.charCodeAt(index) & 0xff;
    return bytes;
  }
}
