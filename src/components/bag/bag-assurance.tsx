import { ChatCircleText, Hammer, Truck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

export type PaymentInfo = { whatsapp: boolean; hasNumber: boolean };
export type DeliveryDates = { making: string; arrives: string } | null;

type Props = { dates: DeliveryDates; payment: PaymentInfo; onNavigate?: () => void };

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[20px_1fr] gap-3 text-[13px] leading-snug">
      <span aria-hidden className="pt-px text-invert-bg">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export function BagAssurance({ dates, payment, onNavigate }: Props) {
  return (
    <ul className="grid gap-3">
      <Row icon={<Hammer size={18} />}>
        {dates ? (
          <>Made by hand for you once your order is paid. Making takes {dates.making}.</>
        ) : (
          <>Made to order by hand. Custom pieces take longer, and we confirm the timing with you.</>
        )}
      </Row>
      {dates ? (
        <Row icon={<Truck size={18} />}>
          Paid today, it should arrive around <span className="whitespace-nowrap">{dates.arrives}</span> by standard shipping.
        </Row>
      ) : null}
      {payment.whatsapp ? (
        <Row icon={<ChatCircleText size={18} />}>
          Nothing is charged on this site. After you order, we arrange payment with you {payment.hasNumber ? "on WhatsApp" : "by email"}.
        </Row>
      ) : null}
      <li className="pl-8 text-[13px]">
        <Link href="/shipping-returns" onClick={onNavigate} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:opacity-60 lg:min-h-0">
          Shipping and returns
        </Link>
      </li>
    </ul>
  );
}
