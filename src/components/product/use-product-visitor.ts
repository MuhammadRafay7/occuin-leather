"use client";

import { useEffect, useState } from "react";
import { readProductVisitor, type ProductVisitor } from "@/lib/actions/product-visitor";

const requests = new Map<string, Promise<ProductVisitor>>();

export function useProductVisitor(productId: string) {
  const [visitor, setVisitor] = useState<ProductVisitor | null>(null);
  useEffect(() => {
    let live = true;
    let request = requests.get(productId);
    if (!request) {
      request = readProductVisitor(productId);
      requests.set(productId, request);
      request.finally(() => requests.delete(productId)).catch(() => undefined);
    }
    request.then((next) => live && setVisitor(next), () => undefined);
    return () => {
      live = false;
    };
  }, [productId]);
  return visitor;
}
