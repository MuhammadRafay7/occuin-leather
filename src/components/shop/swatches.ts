export const SWATCH_FALLBACK = "#b4aca1";

const HEX: Record<string, string> = {
  noir: "#16130f",
  espresso: "#3a2318",
  cognac: "#8a4a21",
  vachetta: "#c08a58",
  tan: "#b5804f",
  craie: "#e6dccb",
  bordeaux: "#561521",
  sapin: "#1e3a2e",
  nuit: "#17233f",
  poudre: "#cf9f96",
  sauge: "#8c9a82",
  ocre: "#b98a26",
  cobalt: "#1f43a0",
  rouge: "#a11d24",
  slate: "#5c6670",
};

export const swatchHex = (name: string) => HEX[name.trim().toLowerCase()] ?? SWATCH_FALLBACK;
