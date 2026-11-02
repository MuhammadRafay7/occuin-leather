import { z } from "zod";

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "CH", name: "Switzerland" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "AT", name: "Austria" },
  { code: "PT", name: "Portugal" },
  { code: "NZ", name: "New Zealand" },
  { code: "MY", name: "Malaysia" },
  { code: "HK", name: "Hong Kong" },
  { code: "KR", name: "South Korea" },
  { code: "ZA", name: "South Africa" },
  { code: "PK", name: "Pakistan" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
] as const;

const COUNTRY_CODES = COUNTRIES.map((country) => country.code) as [string, ...string[]];
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Enter a valid email.")
  .pipe(z.email("Enter a valid email."));

export const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");

export const phoneField = z
  .string("Enter your phone number.")
  .trim()
  .min(1, "Enter your phone number.")
  .max(30, "Enter a valid phone number.")
  .regex(/^\+?[\d\s()-]+$/, "Enter a valid phone number.")
  .refine((value) => /^[1-9]\d{6,14}$/.test(phoneDigits(value)), "Include your country code, such as +92 300 1234567.");

export const newPasswordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use 128 characters or fewer.");

const required = (label: string, max: number) =>
  z.string().trim().min(1, `Enter your ${label}.`).max(max, `Your ${label} is too long.`);

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "This is too long.")
    .transform((value) => value || undefined);

export const addressSchema = z
  .object({
    name: required("full name", 120),
    line1: required("address", 160),
    line2: optional(160),
    city: required("city", 100),
    state: optional(80),
    postalCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/, "Enter a valid postal code."),
    country: z.enum(COUNTRY_CODES, "Choose a country."),
  })
  .superRefine((address, context) => {
    if (STATE_REQUIRED.has(address.country) && !address.state) {
      context.addIssue({ code: "custom", path: ["state"], message: "Enter your state or province." });
    }
  });

export const countryName = (code: string) => COUNTRIES.find((country) => country.code === code)?.name ?? code;

export function addressInput(data: FormData) {
  const read = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: read("name"),
    line1: read("line1"),
    line2: read("line2"),
    city: read("city"),
    state: read("state"),
    postalCode: read("postalCode"),
    country: read("country"),
  };
}
