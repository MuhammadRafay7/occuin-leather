import type { ZodError } from "zod";

export type FormState = {
  error?: string;
  notice?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
};

export function fieldErrors(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fields[key] ??= issue.message;
  }
  return fields;
}

export function textValues(data: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) values[key] = value;
  }
  return values;
}

export function formText(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
