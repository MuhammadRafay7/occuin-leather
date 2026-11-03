import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

const STORE_TAG = "store";
const STORE_SECONDS = 3600;

export const storeCached = <Args extends unknown[], Result>(name: string, read: (...args: Args) => Promise<Result>) =>
  unstable_cache(read, [name], { tags: [STORE_TAG], revalidate: STORE_SECONDS });

export function refreshStore() {
  revalidateTag(STORE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
