import { describe, expect, it } from "vitest";
import { checkField, type CheckoutField } from "@/lib/checkout-checks";
import { dateWindow, arrivalWindow, bagDeliveryDates } from "@/lib/delivery-dates";
import { DEFAULT_DELIVERY } from "@/lib/format";
import { addressSchema, emailField, phoneField } from "@/lib/validation";

const ADDRESS = { name: "Sara Khan", line1: "12 Mall Road", line2: "", city: "Lahore", state: "", postalCode: "54000", country: "PK" };

function serverMessage(field: CheckoutField, value: string, country: string) {
  if (field === "email") {
    const result = emailField.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }
  if (field === "phone") {
    const result = phoneField.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  }
  const result = addressSchema.safeParse({ ...ADDRESS, country, [field]: value });
  return result.success ? undefined : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

const CASES: [CheckoutField, string, string][] = [
  ["email", "sara@example.com", "PK"],
  ["email", " Sara@Example.COM ", "PK"],
  ["email", "sara@example", "PK"],
  ["email", "sara..k@example.com", "PK"],
  ["email", "", "PK"],
  ["phone", "+92 300 1234567", "PK"],
  ["phone", "0092 300 1234567", "PK"],
  ["phone", "0300 1234567", "PK"],
  ["phone", "call me", "PK"],
  ["phone", "", "PK"],
  ["name", "", "PK"],
  ["name", "x".repeat(121), "PK"],
  ["line1", "", "GB"],
  ["city", "Dubai", "AE"],
  ["state", "", "US"],
  ["state", "", "PK"],
  ["state", "CA", "US"],
  ["postalCode", "", "PK"],
  ["postalCode", "", "AE"],
  ["postalCode", "", "HK"],
  ["postalCode", "SW1A 1AA", "GB"],
  ["postalCode", "1", "GB"],
  ["postalCode", "!!!", "US"],
];

describe("checkout inline checks", () => {
  it.each(CASES)("%s %j in %s matches the server", (field, value, country) => {
    expect(checkField(field, value, country)).toBe(serverMessage(field, value, country));
  });
});

describe("addresses without postal codes", () => {
  it("accepts an empty postal code where the country has none", () => {
    expect(addressSchema.safeParse({ ...ADDRESS, country: "AE", postalCode: "" }).success).toBe(true);
  });

  it("still requires a postal code elsewhere", () => {
    expect(addressSchema.safeParse({ ...ADDRESS, country: "GB", postalCode: "" }).success).toBe(false);
  });
});

describe("delivery dates", () => {
  const from = new Date(2026, 10, 3, 12);

  it("formats a window of dates from today", () => {
    expect(dateWindow(from, 35, 45)).toBe("Dec 8 to Dec 18");
    expect(dateWindow(from, 5, 5)).toBe("Nov 8");
  });

  it("adds the year when the window crosses into the next year", () => {
    expect(dateWindow(from, 60, 70)).toBe("Jan 2, 2027 to Jan 12, 2027");
  });

  it("uses the store's estimates per shipping method", () => {
    expect(arrivalWindow("standard", DEFAULT_DELIVERY, from)).toBe(dateWindow(from, DEFAULT_DELIVERY.standardMinDays, DEFAULT_DELIVERY.standardMaxDays));
    expect(arrivalWindow("express", DEFAULT_DELIVERY, from)).toBe(dateWindow(from, DEFAULT_DELIVERY.expressMinDays, DEFAULT_DELIVERY.expressMaxDays));
  });

  it("gives no dates when the bag holds custom work", () => {
    expect(bagDeliveryDates([{ kind: "product" }, { kind: "design" }], DEFAULT_DELIVERY, from)).toBeNull();
    expect(bagDeliveryDates([{ kind: "product" }], DEFAULT_DELIVERY, from)?.arrives).toBe("Dec 8 to Dec 18");
  });
});
