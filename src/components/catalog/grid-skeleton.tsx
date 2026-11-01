export function GridSkeleton() {
  return (
    <div aria-hidden className="mt-5 grid animate-pulse grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-surface" />)}
    </div>
  );
}
