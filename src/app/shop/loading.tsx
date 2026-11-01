import { arrangeCards, cellClass, stageClass } from "@/components/shop/rhythm";
import { ShopStage, SHOP_GRID } from "@/components/shop/shop-stage";
import styles from "@/components/shop/shop.module.css";

const PLACEMENTS = arrangeCards(12);
const PULSE = "animate-pulse rounded-full bg-white/10 motion-reduce:animate-none";

export default function ShopLoading() {
  return (
    <ShopStage aria-busy aria-label="Loading products">
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-8">
        <div className="grid gap-2">
          <div className={`${PULSE} h-[40px] w-56 md:h-[55px] md:w-72`} />
          <div className={`${PULSE} h-[18px] w-72 max-w-full`} />
        </div>
        <div className="grid min-w-0 gap-1 xl:justify-items-end xl:gap-2">
          <div className={`${PULSE} h-12 w-52 [@media(hover:hover)]:h-[42px]`} />
          <div className={`${PULSE} h-11 w-full xl:w-[560px] [@media(hover:hover)]:h-9`} />
        </div>
      </div>
      <div className={`mt-3 md:mt-5 ${SHOP_GRID}`}>
        {PLACEMENTS.map((placement, index) => (
          <div key={index} className={`${styles.pane} flex min-w-0 flex-col rounded-[28px] ${cellClass(placement)}`}>
            <div className={`relative w-full ${stageClass(placement)}`}>
              <span aria-hidden className={styles.pool} />
            </div>
            <div className="grid gap-2 p-3 pt-2 md:p-4 lg:p-5">
              <div className={`${PULSE} h-[18px] w-2/3`} />
              <div className={`${PULSE} h-3.5 w-1/3`} />
            </div>
          </div>
        ))}
      </div>
    </ShopStage>
  );
}
