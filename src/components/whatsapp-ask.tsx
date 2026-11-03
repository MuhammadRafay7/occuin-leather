import { contactDetails } from "@/lib/server/settings";
import { WhatsAppButton } from "./whatsapp-button";

export async function WhatsAppAsk() {
  const { whatsapp } = await contactDetails();
  return whatsapp ? <WhatsAppButton number={whatsapp} /> : null;
}
