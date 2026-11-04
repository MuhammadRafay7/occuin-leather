import { Bone, FieldBones, LineBones, SkeletonPage, SummaryBones, TitleBone } from "@/components/skeleton";

export default function CheckoutLoading() {
  return (
    <SkeletonPage label="Loading checkout" className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <TitleBone />
      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-x-12">
        <div className="grid content-start gap-10">
          <div className="grid gap-5">
            <Bone className="h-7 w-40" round="rounded-[10px]" />
            <FieldBones count={2} />
          </div>
          <div className="grid gap-5">
            <Bone className="h-7 w-48" round="rounded-[10px]" />
            <FieldBones count={4} />
          </div>
        </div>
        <div className="grid content-start gap-6">
          <LineBones count={2} thumb="size-16" />
          <SummaryBones rows={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
