import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PendingTextButton } from "@/components/pending-button";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/account";
import { requireUser } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { AddressCard } from "../address-card";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const saved = await db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, user.id))
    .orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.createdAt));

  return (
    <>
      <PageTitle>Addresses</PageTitle>
      {saved.length ? (
        <div className="grid justify-items-start gap-8">
          <ul className="grid w-full gap-4 sm:grid-cols-2">
            {saved.map((entry) => (
              <li key={entry.id} className="grid content-between gap-4 border border-line p-4">
                <div className="grid gap-2">
                  {entry.isDefault ? <p className="text-xs text-muted">Default</p> : null}
                  <AddressCard address={entry.address} />
                </div>
                <div className="flex flex-wrap gap-x-5">
                  <Link href={`/account/addresses/${entry.id}`} className="py-2 text-sm underline underline-offset-4 hover:opacity-60">Edit</Link>
                  {entry.isDefault ? null : (
                    <form action={setDefaultAddress}>
                      <input type="hidden" name="id" value={entry.id} />
                      <PendingTextButton pendingLabel="Saving">Make default</PendingTextButton>
                    </form>
                  )}
                  <form action={deleteAddress}>
                    <input type="hidden" name="id" value={entry.id} />
                    <PendingTextButton pendingLabel="Deleting">Delete</PendingTextButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <LinkButton href="/account/addresses/new" look="outline">Add an address</LinkButton>
        </div>
      ) : (
        <EmptyState
          title="No saved addresses"
          body="Save an address to check out faster."
          action={<LinkButton href="/account/addresses/new">Add an address</LinkButton>}
        />
      )}
    </>
  );
}
