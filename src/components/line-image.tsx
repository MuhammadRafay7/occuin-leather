import Image from "next/image";

export function LineImage({ src, alt, sizes = "96px" }: { src: string | null; alt: string; sizes?: string }) {
  if (!src) return null;
  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized={src.startsWith("/api/")} className="object-cover" />;
}
