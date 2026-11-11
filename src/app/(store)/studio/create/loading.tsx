import { Bone, SkeletonPage } from "@/components/skeleton";

export default function CreateLoading() {
  return (
    <SkeletonPage label="Loading the pattern board" className="flex h-dvh flex-col gap-3 px-3 pb-3 pt-[72px] md:px-6 md:pb-6 md:pt-[84px]">
      <Bone className="min-h-0 w-full flex-1" round="rounded-[32px]" />
      <Bone className="mx-auto h-[62px] w-full max-w-[640px]" round="rounded-[26px]" />
    </SkeletonPage>
  );
}
