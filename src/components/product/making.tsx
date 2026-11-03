type Step = { title: string; body: string };

type Props = {
  payment: "whatsapp" | "email" | "card";
  makingTime: string;
  shipping: string[];
};

const PAYMENT: Record<Props["payment"], Step> = {
  whatsapp: { title: "We arrange payment on WhatsApp", body: "You send us the order message we write for you, and we reply with how to pay. No card is taken on this site." },
  email: { title: "We arrange payment by email", body: "We write to you with how to pay. No card is taken on this site." },
  card: { title: "You pay by card", body: "Payment is handled by Stripe at checkout. We never see your full card number." },
};

export function Making({ payment, makingTime, shipping }: Props) {
  const steps: Step[] = [
    { title: "You place the order", body: "Choose Buy now or Add to bag. Nothing is cut until your order is paid." },
    PAYMENT[payment],
    { title: "We make your piece", body: `It is cut, stitched and finished for you in Pakistan. This takes ${makingTime}, packing included.` },
    { title: "It travels to you", body: shipping.join(" ") },
  ];

  return (
    <section aria-labelledby="making" className="mt-14 border-t border-line pt-8 md:mt-16">
      <div className="grid gap-2 md:flex md:items-end md:justify-between md:gap-8">
        <h2 id="making" className="font-display text-[30px] leading-[1.1] text-invert-bg md:text-[36px]">Made for you, after you order</h2>
        <p className="max-w-[44ch] text-sm leading-[1.6] text-fg/75">Every piece is made to order. Work on yours begins once your order is paid.</p>
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-[24px] bg-surface p-4 sm:block sm:p-5">
            <span aria-hidden className="w-6 shrink-0 font-display text-[34px] leading-none text-invert-bg/25 sm:w-auto sm:text-[44px]">{index + 1}</span>
            <div>
              <h3 className="text-[15px] font-medium leading-snug sm:mt-3">{step.title}</h3>
              <p className="mt-1 text-[13px] leading-[1.55] text-muted sm:mt-1.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
