import { LineBones, SkeletonPage, SummaryBones, TitleBone } from "@/components/skeleton";

export default function BagLoading() {
  return (
    <SkeletonPage label="Loading your bag" className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <TitleBone sub={false} />
      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-x-12">
        <LineBones count={2} thumb="h-[107px] w-20" />
        <SummaryBones rows={3} />
      </div>
    </SkeletonPage>
  );
}
