import { BRAND } from "../format";
import { html, Html } from "../safe-html";
import type { SheetSection } from "./rows";
import type { Sheet, SheetLine, SheetPicture } from "./sheet";
import { SHEET_VIEWS } from "./views";

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f1f1; color: #14201c; font: 12.5px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .bar { max-width: 210mm; margin: 0 auto; padding: 12px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .bar a, .bar button { font: inherit; color: inherit; background: #fff; border: 1px solid #14201c; padding: 6px 12px; text-decoration: none; cursor: pointer; }
  .bar .primary { background: #14201c; color: #fff; }
  .sheet { background: #fff; max-width: 210mm; margin: 0 auto 32px; padding: 14mm; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #14201c; padding-bottom: 10px; }
  .brand { font: 22px/1.1 Georgia, "Times New Roman", serif; letter-spacing: .14em; margin: 0; }
  h1 { font-size: 15px; font-weight: 600; margin: 0; text-align: right; }
  .muted { color: #646469; }
  .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
  .summary dt, h3 { font-size: 10.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #646469; margin: 0 0 2px; }
  .summary dd { margin: 0; font-weight: 600; }
  .stop { border: 2px solid #b3261e; color: #b3261e; font-weight: 600; padding: 8px 12px; margin: 12px 0; }
  .line { margin-top: 18px; }
  .line + .line { break-before: page; }
  .line h2 { font-size: 16px; font-weight: 600; margin: 0; }
  .note { margin: 4px 0 0; color: #646469; }
  .pictures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 10px 0; }
  figure { margin: 0; break-inside: avoid; }
  figure img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; background: #f1f1f1; }
  figcaption { font-size: 10.5px; color: #646469; padding: 2px 0; }
  .missing { border: 1px dashed #646469; padding: 8px 12px; margin: 10px 0; color: #646469; }
  .sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; align-items: start; }
  section { break-inside: avoid; margin-top: 10px; }
  h3 { border-bottom: 1px solid #14201c; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #dcdcdc; padding: 3px 6px 3px 0; font-weight: 400; overflow-wrap: anywhere; }
  th { width: 42%; color: #646469; }
  td:last-child { padding-right: 0; }
  .swatch { display: inline-block; width: 10px; height: 10px; border: 1px solid #14201c; margin-right: 4px; vertical-align: -1px; }
  .exact { font-weight: 600; white-space: pre-wrap; }
  .downloads a { color: inherit; margin-right: 12px; }
  footer { margin-top: 18px; color: #646469; font-size: 11px; }
  @media (max-width: 640px) {
    .sheet { padding: 16px; }
    .summary, .sections { grid-template-columns: minmax(0, 1fr); }
    .pictures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { max-width: none; margin: 0; padding: 0; }
    .sheet * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

export type SheetUrls = { file: (fileId: string, download?: boolean) => string; download: (path: string) => string; pdf: string; back?: string };

const sectionBlock = (section: SheetSection) => html`<section>
  <h3>${section.title}</h3>
  <table><tbody>
    ${section.rows.map((item) => html`<tr><th scope="row">${item.label}</th><td${new Html(item.exact ? ' class="exact"' : "")}>${item.swatch ? html`<span class="swatch" style="background:${item.swatch}"></span>` : null}${item.value}</td></tr>`)}
  </tbody></table>
</section>`;

const figure = (picture: SheetPicture, urls: SheetUrls) => html`<figure><img src="${urls.file(picture.fileId)}" alt="${picture.label}" loading="eager"><figcaption>${picture.label}${picture.download ? html` <a href="${urls.file(picture.fileId, true)}">Download file</a>` : null}</figcaption></figure>`;

const pictureGrid = (pictures: SheetPicture[], urls: SheetUrls) => (pictures.length ? html`<div class="pictures">${pictures.map((picture) => figure(picture, urls))}</div>` : null);

function lineBlock(line: SheetLine, index: number, urls: SheetUrls) {
  const missing = line.missingViews.map((key) => SHEET_VIEWS[key].label).join(", ");
  return html`<article class="line">
    <h2>${index + 1}. ${line.title}</h2>
    ${line.kind === "payment" ? null : html`<p class="note">Quantity ${line.quantity}</p>`}
    ${line.notes.map((note) => html`<p class="note">${note}</p>`)}
    ${pictureGrid(line.pictures, urls)}
    ${missing ? html`<p class="missing">Images not ready yet: ${missing}.</p>` : null}
    ${line.downloads.length ? html`<p class="downloads">${line.downloads.map((item) => html`<a href="${urls.download(item.path)}">${item.label}</a>`)}</p>` : null}
    <div class="sections">${line.sections.map(sectionBlock)}</div>
    ${line.logos.length ? html`<section><h3>Logo files</h3>${pictureGrid(line.logos, urls)}</section>` : null}
    ${line.references.length ? html`<section><h3>Customer reference images</h3>${pictureGrid(line.references, urls)}</section>` : null}
  </article>`;
}

function body(sheet: Sheet, urls: SheetUrls) {
  return html`<header>
      <p class="brand">${BRAND.name}</p>
      <h1>Manufacturer sheet<br>${sheet.reference}</h1>
    </header>
    ${sheet.stopped ? html`<p class="stop">This order was cancelled. Do not start or continue work.</p>` : null}
    <dl class="summary">
      <div><dt>Order</dt><dd>${sheet.reference}</dd></div>
      <div><dt>Order date</dt><dd>${sheet.orderDate}</dd></div>
      <div><dt>Pieces to make</dt><dd>${sheet.pieces}</dd></div>
      <div><dt>Required by</dt><dd>${sheet.requiredBy ?? "Ask OCCUIN"}</dd></div>
    </dl>
    ${sheet.address ? html`<section><h3>Deliver to</h3><p>${sheet.address.map((line) => html`${line}<br>`)}</p></section>` : null}
    ${sheet.lines.map((line, index) => lineBlock(line, index, urls))}
    <footer>${BRAND.name} manufacturer sheet ${sheet.reference}. Questions go to OCCUIN, not to the customer.</footer>`;
}

export function sheetDocument(sheet: Sheet, urls: SheetUrls, nonce: string | undefined) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Manufacturer sheet ${sheet.reference}</title>
<style>${new Html(STYLE)}</style>
</head>
<body>
<div class="bar">${urls.back ? html`<a href="${urls.back}">Back</a>` : null}<button type="button" id="print">Print</button><a class="primary" href="${urls.pdf}">Download PDF</a></div>
<main class="sheet">${body(sheet, urls)}</main>
<script nonce="${nonce ?? ""}">document.getElementById("print").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`.text;
}
