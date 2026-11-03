"use client";

import { SaveButton } from "./save-button";
import { useProductVisitor } from "./use-product-visitor";

export function ProductSaveButton({ productId, productName }: { productId: string; productName: string }) {
  const visitor = useProductVisitor(productId);
  return <SaveButton productId={productId} productName={productName} saved={visitor?.saved ?? false} />;
}
