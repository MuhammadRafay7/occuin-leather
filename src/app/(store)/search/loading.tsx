import { Bone, ProductGridBone, SkeletonPage } from "@/components/skeleton";

export default function SearchLoading() {
  return (
    <SkeletonPage label="Searching">
      <Bone className="h-10 w-40 md:h-[60px] md:w-56" round="rounded-[16px]" />
      <div className="mt-8 flex max-w-2xl gap-2">
        <Bone className="h-12 flex-1" round="rounded-none" />
        <Bone className="h-12 w-28" />
      </div>
      <Bone className="mt-6 h-3.5 w-40" />
      <ProductGridBone className="mt-6 grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 lg:grid-cols-4" />
    </SkeletonPage>
  );
}
