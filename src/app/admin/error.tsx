"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";
import { buttonClass } from "./_components/ui";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="adm-empty">
      <WarningCircle size={20} aria-hidden="true" />
      <p className="text-sm font-medium">This page could not load</p>
      <p className="text-sm text-muted">The data did not come back. Nothing was changed.</p>
      <button type="button" onClick={retry} className={`${buttonClass} mt-2`}>Try again</button>
    </div>
  );
}
