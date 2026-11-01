export async function sendMail(message: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] to ${message.to}: ${message.subject}\n${message.text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, ...message }),
  });
  if (!response.ok) console.error(`[mail] delivery failed with ${response.status}`);
}
