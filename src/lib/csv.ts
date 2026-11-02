export type CsvRecord = { line: number; cells: string[] };

const FORMULA_START = /^'*(?:[\t\r\n]|\s*[=+\-@])/;

export const neutraliseCell = (value: string) => (FORMULA_START.test(value) ? `'${value}` : value);
export const restoreCell = (value: string) => (value.startsWith("'") && FORMULA_START.test(value) ? value.slice(1) : value);

export const csvCell = (value: string) => `"${neutraliseCell(value).replaceAll('"', '""')}"`;
export const csvLine = (values: string[]) => values.map(csvCell).join(",");

export function parseCsv(input: string): { records: CsvRecord[]; error?: string } {
  const text = input.replace(/^﻿/, "");
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (cells.some((value) => value.trim())) records.push({ line: recordLine, cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === "\n") line++;
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += char;
    }
  }
  if (quoted) return { records: [], error: `A quoted cell starting on line ${recordLine} never closes.` };
  if (cell || cells.length) endRecord();
  return { records };
}
