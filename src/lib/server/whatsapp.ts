const API_VERSION = "v21.0";

export function whatsappNumber() {
  const digits = (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

export async function sendWhatsApp(message: { to: string; text: string }) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.info("[whatsapp] not configured, nothing sent");
    return false;
  }
  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: message.to.replace(/\D/g, ""), type: "text", text: { body: message.text } }),
  }).catch(() => null);
  if (!response?.ok) console.error(`[whatsapp] delivery failed${response ? ` with ${response.status}` : ""}`);
  return Boolean(response?.ok);
}
