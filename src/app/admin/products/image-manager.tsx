"use client";

import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react";
import Image from "next/image";
import { MAX_PRODUCT_IMAGES } from "@/lib/media";
import { buttonClass, Tag } from "../_components/ui";
import { UploadButton } from "../media/upload-button";

export type MediaChoice = { path: string; filename: string };

const ICON_BUTTON = `${buttonClass} flex-1 !px-0`;

export function ImageManager({ images, library, error, onChange }: { images: string[]; library: MediaChoice[]; error?: string; onChange: (images: string[]) => void }) {
  const choices = library.filter((choice) => !images.includes(choice.path));
  const room = MAX_PRODUCT_IMAGES - images.length;

  const add = (paths: string[]) => onChange([...images, ...paths.filter((path) => !images.includes(path))].slice(0, MAX_PRODUCT_IMAGES));
  const remove = (path: string) => onChange(images.filter((item) => item !== path));
  const move = (index: number, offset: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item!);
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">The first photo is the main one. The second shows when a shopper hovers over it.</p>
      {images.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((src, index) => (
            <li key={src} className="grid content-start gap-1 overflow-hidden rounded-[6px] border border-line p-1" data-testid="product-image">
              <span className="relative block aspect-square overflow-hidden rounded-[4px] bg-surface">
                <Image unoptimized fill sizes="240px" src={src} alt={`Product photo ${index + 1}`} className="object-cover" />
              </span>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)} className={ICON_BUTTON}><ArrowLeft size={14} /></button>
                <button type="button" aria-label={`Move photo ${index + 1} later`} disabled={index === images.length - 1} onClick={() => move(index, 1)} className={ICON_BUTTON}><ArrowRight size={14} /></button>
                <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => remove(src)} className={ICON_BUTTON}><X size={14} /></button>
              </div>
              {index === 0 ? <span className="grid min-h-8 place-items-center"><Tag>Main photo</Tag></span> : <button type="button" onClick={() => move(index, -index)} className={buttonClass}>Make main photo</button>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-empty text-muted">No photos yet. Upload one to get started.</p>
      )}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      {room > 0 ? (
        <>
          <UploadButton label="Upload photos" onUploaded={add} />
          {choices.length ? (
            <details className="rounded-[6px] border border-line p-3">
              <summary className="cursor-pointer">Choose from photos you already uploaded</summary>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {choices.map((choice) => (
                  <li key={choice.path}>
                    <button type="button" onClick={() => add([choice.path])} aria-label={`Add ${choice.filename}`} className="relative block aspect-square w-full overflow-hidden rounded-[6px] border border-line bg-surface hover:border-fg">
                      <Image unoptimized fill sizes="120px" src={choice.path} alt="" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted">This product has the maximum of {MAX_PRODUCT_IMAGES} photos.</p>
      )}
    </div>
  );
}
