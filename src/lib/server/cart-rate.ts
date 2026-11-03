import { hitRateLimit } from "./auth";
import { clientIp } from "./client-ip";

export async function cartTooFast(owner: string | null) {
  const [byAddress, byOwner] = await Promise.all([hitRateLimit(`cart:ip:${await clientIp()}`, 120, 60), owner ? hitRateLimit(`cart:owner:${owner}`, 60, 60) : false]);
  return byAddress || byOwner;
}
