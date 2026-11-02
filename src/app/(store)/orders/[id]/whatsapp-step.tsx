import { buttonClass } from "@/components/ui";

type Props = {
  reference: string;
  placed: boolean;
  chatUrl: string | null;
  number: string | null;
  storeEmail: string;
  autoCancelDays: number;
};

export function WhatsAppStep({ reference, placed, chatUrl, number, storeEmail, autoCancelDays }: Props) {
  const heading = placed ? "Thank you. One more step" : "Your next step";
  const deadline = autoCancelDays ? ` We cancel unpaid orders after ${autoCancelDays} ${autoCancelDays === 1 ? "day" : "days"}.` : "";
  return (
    <section data-testid="whatsapp-step" aria-labelledby="whatsapp-step-title" className="mb-10 grid justify-items-start gap-3 border border-line bg-surface p-5">
      <h2 id="whatsapp-step-title" className="font-display text-2xl">{heading}</h2>
      <p className="text-sm text-muted">Order {reference} is saved and your items are held, but it is not paid yet. We start making it once it is paid.{deadline}</p>
      {chatUrl ? (
        <>
          <p className="text-sm">Open WhatsApp and send the message we have written for you. We will reply with how to pay.</p>
          <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("solid", "w-full sm:w-auto")}>Open WhatsApp</a>
          <p className="text-xs text-muted">If WhatsApp does not open, message +{number} with your reference {reference}.</p>
        </>
      ) : (
        <p className="text-sm">
          Write to us at <a href={`mailto:${storeEmail}?subject=${encodeURIComponent(`Order ${reference}`)}`} className="underline underline-offset-4">{storeEmail}</a> with your reference {reference} and we will arrange payment.
        </p>
      )}
    </section>
  );
}
