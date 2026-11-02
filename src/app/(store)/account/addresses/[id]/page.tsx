import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { AddressForm } from "../address-form";

export const metadata: Metadata = { title: "Edit address" };

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/addresses/${encodeURIComponent(id)}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [entry] = await db
    .select()
    .from(schema.addresses)
    .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)));
  if (!entry) notFound();

  return (
    <>
      <PageTitle>Edit address</PageTitle>
      <AddressForm id={entry.id} defaults={entry.address} isDefault={entry.isDefault} />
    </>
  );
}
