"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

const TEXT_BUTTON = "py-2 text-sm underline underline-offset-4 hover:opacity-60 disabled:opacity-40";

export function PendingTextButton({ pendingLabel, children, ...props }: ComponentProps<"button"> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={TEXT_BUTTON} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}
