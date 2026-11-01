const CARDS = Array.from({ length: 12 }, (_, index) => index);

export default function ShopLoading() {
  return (
    <div className="px-4 pb-24 pt-24 md:px-8" aria-busy="true" aria-label="Loading products">
      <div className="mb-10 h-12 w-64 animate-pulse bg-surface md:h-16" />
      <div className="-mt-6 h-6 w-72 max-w-full animate-pulse bg-surface" />
      <div className="mt-10 grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-4">
        {CARDS.map((index) => (
          <div key={index}>
            <div className="aspect-[3/4] animate-pulse bg-surface" />
            <div className="mt-3 h-4 w-2/3 animate-pulse bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
