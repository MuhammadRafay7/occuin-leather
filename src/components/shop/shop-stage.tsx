import type { ReactNode } from "react";
import styles from "./shop.module.css";

export const SHOP_GRID = "grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5";

export function ShopStage({ children, ...props }: { children: ReactNode; "aria-busy"?: boolean; "aria-label"?: string }) {
  return (
    <div {...props} className="relative min-h-dvh overflow-clip rounded-b-[36px] bg-[#0f211d]">
      <div aria-hidden className={`${styles.stage} pointer-events-none sticky top-0 -mb-[100lvh] h-lvh`} />
      <div className="px-page relative mx-auto max-w-[1600px] pb-24 pt-[calc(4.75rem+env(safe-area-inset-top))] md:pb-28 md:pt-[calc(5.5rem+env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}
