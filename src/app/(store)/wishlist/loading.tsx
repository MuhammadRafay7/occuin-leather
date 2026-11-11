import { ProductGridBone, SkeletonPage, TitleBone } from "@/components/skeleton";

export default function WishlistLoading() {
  return (
    <SkeletonPage label="Loading saved items">
      <TitleBone sub={false} />
      <ProductGridBone count={4} />
    </SkeletonPage>
  );
}
