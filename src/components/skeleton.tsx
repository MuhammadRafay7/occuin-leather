import type { ReactNode } from "react";

// Loading placeholders for the storefront. They copy the spacing of the real pages so content
// swaps in without the layout jumping, and use the same pulse as the bag drawer and quick view.

const PULSE = "animate-pulse motion-reduce:animate-none";
const TONES = { light: "bg-fg/6", dark: "bg-white/10" };

export function Bone({ className = "", round = "rounded-full", tone = "light" }: { className?: string; round?: string; tone?: keyof typeof TONES }) {
  return <div aria-hidden className={`${PULSE} ${TONES[tone]} ${round} ${className}`} />;
}

export function SkeletonPage({ label = "Loading", className = "px-page pt-header", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function TitleBone({ sub = true }: { sub?: boolean }) {
  return (
    <div className="mb-10">
      <Bone className="h-12 w-64 max-w-full md:h-[72px] md:w-[28rem]" round="rounded-[18px]" />
      {sub ? <Bone className="mt-4 h-4 w-80 max-w-full" /> : null}
    </div>
  );
}

export function TextBones({ lines = 4, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`grid gap-3 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Bone key={index} className={`h-4 ${index === lines - 1 ? "w-3/5" : index % 2 ? "w-11/12" : "w-full"}`} />
      ))}
    </div>
  );
}

export function CardBone({ ratio = "aspect-[3/4]" }: { ratio?: string }) {
  return (
    <div>
      <Bone className={`${ratio} w-full`} round="rounded-none" />
      <div className="mt-2 grid gap-1.5 sm:mt-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <Bone className="h-3.5 w-2/3 sm:w-1/2" />
        <Bone className="h-3.5 w-14" />
      </div>
    </div>
  );
}

export function ProductGridBone({ count = 8, className = "grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 lg:grid-cols-4" }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <CardBone key={index} />
      ))}
    </div>
  );
}

export function LineBones({ count = 3, thumb = "size-20" }: { count?: number; thumb?: string }) {
  return (
    <ul aria-hidden className="border-t border-line">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex gap-4 border-b border-line py-5">
          <Bone className={`${thumb} shrink-0`} round="rounded-none" />
          <div className="grid flex-1 content-start gap-2 pt-1">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3.5 w-1/3" />
            <Bone className="h-3.5 w-1/4" />
          </div>
          <Bone className="mt-1 h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function SummaryBones({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="grid gap-6 self-start">
      <Bone className="h-[3px] w-full" />
      <div className="grid gap-3 border-t border-line pt-6">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex justify-between gap-4">
            <Bone className="h-4 w-24" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-3">
          <Bone className="h-5 w-16" />
          <Bone className="h-5 w-20" />
        </div>
      </div>
      <Bone className="h-12 w-full" />
    </div>
  );
}

export function FieldBones({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-2">
          <Bone className="h-3.5 w-24" />
          <Bone className="h-12 w-full" round="rounded-none" />
        </div>
      ))}
    </div>
  );
}

export function FormPageSkeleton({ width = "max-w-[460px]", fields = 2, label = "Loading" }: { width?: string; fields?: number; label?: string }) {
  return (
    <SkeletonPage label={label} className={`mx-auto ${width} px-page pb-24 pt-header`}>
      <TitleBone sub={false} />
      <div className="grid gap-6">
        <FieldBones count={fields} />
        <Bone className="h-12 w-full" />
        <Bone className="h-4 w-2/3" />
      </div>
    </SkeletonPage>
  );
}

export function TextPageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <SkeletonPage label={label} className="px-page pb-24 pt-header">
      <TitleBone />
      <div className="grid max-w-3xl gap-12">
        <TextBones lines={4} />
        <TextBones lines={5} />
      </div>
    </SkeletonPage>
  );
}
