import { Bone, SkeletonPage } from "@/components/skeleton";

// Matches the "Pick a bag to change" chooser that /studio opens on.
export default function StudioLoading() {
  return (
    <SkeletonPage label="Loading the studio" className="mx-auto max-w-[1440px] px-2 pb-10 pt-[96px] md:px-4 md:pt-[112px]">
      <div className="mb-8 grid gap-3 px-2 md:mb-10 md:grid-cols-[1fr_auto] md:items-end md:gap-12">
        <Bone className="h-11 w-72 max-w-full md:h-[76px] md:w-[36rem]" round="rounded-[18px]" />
        <div className="grid gap-2 md:w-[24rem] md:pb-2">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-2/3" />
        </div>
      </div>
      <Bone className="mb-1.5 h-[200px] w-full lg:mb-2" round="rounded-none" />
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4 lg:gap-2">
        <Bone className="col-span-2 row-span-2 aspect-square w-full" round="rounded-none" />
        {[0, 1, 2, 3].map((item) => <Bone key={item} className="aspect-square w-full" round="rounded-none" />)}
      </div>
    </SkeletonPage>
  );
}
