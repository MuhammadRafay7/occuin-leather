import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { AddressForm } from "../address-form";

export const metadata: Metadata = { title: "Add an address" };

export default async function NewAddressPage() {
  await requireUser("/account/addresses/new");
  return (
    <>
      <PageTitle>Add an address</PageTitle>
      <AddressForm />
    </>
  );
}
