import type { ShippingAddress } from "@/lib/server/schema";
import { countryName } from "@/lib/validation";

export function AddressCard({ address }: { address: ShippingAddress }) {
  return (
    <address className="text-sm not-italic">
      <p>{address.name}</p>
      <p>{address.line1}</p>
      {address.line2 ? <p>{address.line2}</p> : null}
      <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
      <p>{countryName(address.country)}</p>
    </address>
  );
}
