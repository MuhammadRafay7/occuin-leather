export type CsvValue = string | number | null;

export function csvCell(value: CsvValue) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[\s=+\-@＝＋－＠]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const csvText = (head: string[], rows: CsvValue[][]) => [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

export const csvMoney = (cents: number) => cents / 100;

export function csvResponse(filename: string, head: string[], rows: CsvValue[][]) {
  return new Response(csvText(head, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
