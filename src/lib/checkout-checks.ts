import { EMAIL_PATTERN, needsPostalCode, PHONE_PATTERN, phoneHasCountryCode, POSTAL_PATTERN, STATE_REQUIRED } from "./address-rules";

export type CheckoutField = "email" | "phone" | "name" | "line1" | "line2" | "city" | "state" | "postalCode";

const requiredText = (label: string, max: number) => (value: string) => {
  if (!value) return `Enter your ${label}.`;
  if (value.length > max) return `Your ${label} is too long.`;
  return undefined;
};

const optionalText = (max: number) => (value: string) => (value.length > max ? "This is too long." : undefined);

const CHECKS: Record<CheckoutField, (value: string, country: string) => string | undefined> = {
  email: (value) => (value.length > 254 || !EMAIL_PATTERN.test(value.toLowerCase()) ? "Enter a valid email." : undefined),
  phone: (value) => {
    if (!value) return "Enter your phone number.";
    if (value.length > 30 || !PHONE_PATTERN.test(value)) return "Enter a valid phone number.";
    return phoneHasCountryCode(value) ? undefined : "Include your country code, such as +92 300 1234567.";
  },
  name: requiredText("full name", 120),
  line1: requiredText("address", 160),
  line2: optionalText(160),
  city: requiredText("city", 100),
  state: (value, country) => (STATE_REQUIRED.has(country) && !value ? "Enter your state or province." : optionalText(80)(value)),
  postalCode: (value, country) => {
    if (!value) return needsPostalCode(country) ? "Enter a valid postal code." : undefined;
    return POSTAL_PATTERN.test(value) ? undefined : "Enter a valid postal code.";
  },
};

export const isCheckoutField = (name: string): name is CheckoutField => Object.hasOwn(CHECKS, name);

export const checkField = (field: CheckoutField, value: string, country: string) => CHECKS[field](value.trim(), country);
