"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRef, useState, type ChangeEvent } from "react";
import { buttonClass, primaryButtonClass } from "../_components/ui";
import { uploadImage } from "./upload";

export function UploadButton({ label, onUploaded, hint = true, primary = false }: { label: string; onUploaded: (paths: string[]) => void; hint?: boolean; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setErrors([]);
    const uploaded: string[] = [];
    const problems: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress(`Uploading ${index + 1} of ${files.length}`);
      const outcome = await uploadImage(file);
      if (outcome.ok) uploaded.push(outcome.path);
      else problems.push(outcome.error);
    }
    setProgress(null);
    setErrors(problems);
    if (uploaded.length) onUploaded(uploaded);
  }

  return (
    <div className="grid justify-items-start gap-1">
      <button type="button" disabled={progress !== null} onClick={() => input.current?.click()} className={primary ? primaryButtonClass : buttonClass}><UploadSimple size={14} aria-hidden="true" />{progress ?? label}</button>
      <input ref={input} data-testid="media-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choose} className="sr-only" tabIndex={-1} aria-label={label} />
      {hint ? <p className="text-xs text-muted">JPG, PNG or WebP, under 3.5 MB each.</p> : null}
      {errors.map((error) => (
        <p key={error} role="alert" className="text-xs text-danger">{error}</p>
      ))}
    </div>
  );
}
