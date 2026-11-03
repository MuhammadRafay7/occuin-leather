export const STATE_REQUIRED = new Set(["US", "CA", "AU"]);
export const NO_POSTAL_CODE = new Set(["AE", "QA", "HK"]);
export const POSTAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/;
export const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
export const PHONE_PATTERN = /^\+?[\d\s()-]+$/;

export const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");
export const phoneHasCountryCode = (phone: string) => /^[1-9]\d{6,14}$/.test(phoneDigits(phone));
export const needsPostalCode = (country: string) => !NO_POSTAL_CODE.has(country);
