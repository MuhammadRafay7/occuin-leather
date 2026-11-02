export class Html {
  constructor(readonly text: string) {}
}

export const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

type Slot = string | number | Html | Html[] | null | undefined;

const render = (slot: Slot): string => {
  if (slot === null || slot === undefined) return "";
  if (slot instanceof Html) return slot.text;
  if (Array.isArray(slot)) return slot.map(render).join("");
  return escapeHtml(String(slot));
};

export function html(strings: TemplateStringsArray, ...slots: Slot[]) {
  return new Html(strings.reduce((out, part, index) => out + part + render(slots[index]), ""));
}
