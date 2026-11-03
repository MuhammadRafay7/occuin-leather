type Arrival = { slug: string; createdAt: Date };

export const NEW_IN_MINIMUM = 2;

export function newArrivals<T extends Arrival>(products: T[], shown: Iterable<string>, limit: number): T[] {
  const taken = new Set(shown);
  const fresh = products
    .filter((product) => !taken.has(product.slug))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
  return fresh.length >= NEW_IN_MINIMUM ? fresh : [];
}
