import { isIPv6 } from "node:net";
import { headers } from "next/headers";

export function ipBucket(ip: string) {
  const address = ip.toLowerCase().replace(/^::ffff:(?=\d+\.)/, "");
  if (!isIPv6(address)) return address;
  const [head = "", tail = ""] = address.split("%")[0]!.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((group) => group.padStart(4, "0")).join(":")}::/64`;
}

export async function clientIp() {
  const list = await headers();
  return ipBucket(list.get("x-real-ip") ?? list.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown");
}
