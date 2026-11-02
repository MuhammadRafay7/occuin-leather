export const newsletterFooter = (unsubscribeUrl: string) =>
  `\n\n--\nYou are receiving this because you joined the OCCUIN newsletter.\nUnsubscribe: ${unsubscribeUrl}\n`;

export const newsletterText = (body: string, unsubscribeUrl: string) => `${body.trim()}${newsletterFooter(unsubscribeUrl)}`;
