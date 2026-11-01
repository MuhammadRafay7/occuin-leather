"use client";

import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 pt-24 md:px-8">
      <EmptyState
        title="Something went wrong"
        body="This page did not load. Try again, and if it keeps happening, let us know through the contact page."
        action={<Button type="button" look="outline" onClick={retry}>Try again</Button>}
      />
    </div>
  );
}
