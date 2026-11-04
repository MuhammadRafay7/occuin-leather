import { Bone, LineBones, SkeletonPage, SummaryBones } from "@/components/skeleton";

export default function OrderLoading() {
  return (
    <SkeletonPage label="Loading your order" className="mx-auto max-w-[1080px] px-page pb-24 pt-header">
      <div className="mb-10 grid gap-3 border border-line p-5">
        <Bone className="h-7 w-64 max-w-full" round="rounded-[10px]" />
        <Bone className="h-4 w-80 max-w-full" />
        <Bone className="h-4 w-56 max-w-full" />
      </div>
      <Bone className="mb-6 h-9 w-48" round="rounded-[12px]" />
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <LineBones count={2} thumb="h-[96px] w-[72px] sm:h-[128px] sm:w-24" />
        <SummaryBones rows={3} />
      </div>
    </SkeletonPage>
  );
}
