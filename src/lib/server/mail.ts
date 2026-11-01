export async function sendMail(message: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] RESEND_API_KEY is not set, so nothing was sent");
      return false;
    }
    console.info(`[mail] to ${message.to}: ${message.subject}\n${message.text}`);
    return true;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, ...message }),
  });
  if (!response.ok) console.error(`[mail] delivery failed with ${response.status}`);
  return response.ok;
}
