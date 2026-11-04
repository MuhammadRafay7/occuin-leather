import { Bone, LineBones, SkeletonPage, TitleBone } from "@/components/skeleton";

// Shown inside the account layout, so the account menu stays in place while a page loads.
export default function AccountLoading() {
  return (
    <SkeletonPage label="Loading your account" className="">
      <TitleBone />
      <div className="grid gap-12">
        <section className="grid gap-4">
          <Bone className="h-7 w-40" round="rounded-[10px]" />
          <LineBones count={2} thumb="h-[80px] w-[60px]" />
        </section>
        <section className="grid gap-4">
          <Bone className="h-7 w-44" round="rounded-[10px]" />
          <div className="grid w-full max-w-md gap-2 border border-line p-4">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-4 w-3/4" />
            <Bone className="h-4 w-2/5" />
          </div>
        </section>
      </div>
    </SkeletonPage>
  );
}
