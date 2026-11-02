const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA_PATH = new RegExp(`^/api/media/(${UUID})$`);

export const MEDIA_MAX_BYTES = 3_500_000;
export const MAX_PRODUCT_IMAGES = 12;
export const IMAGE_PATH = new RegExp(`^(?:/images/(?!.*\\.\\.)[\\w./-]+|/api/media/${UUID})$`);

export const mediaPath = (id: string) => `/api/media/${id}`;
export const mediaIdOf = (path: string) => MEDIA_PATH.exec(path)?.[1] ?? null;
export const mediaIdsIn = (paths: string[]) => paths.flatMap((path) => mediaIdOf(path) ?? []);

export function safeFilename(name: string) {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return `${base || "image"}.webp`;
}
