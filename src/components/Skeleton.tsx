export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white/5 animate-pulse rounded-2xl ${className}`} />
  );
}

export function NewsCardSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBox className="aspect-[21/9] rounded-[40px]" />
      <SkeletonBox className="h-5 w-24" />
      <SkeletonBox className="h-8 w-3/4" />
      <SkeletonBox className="h-5 w-full" />
      <SkeletonBox className="h-5 w-2/3" />
    </div>
  );
}

export function PolicyCardSkeleton() {
  return (
    <div className="bento-card space-y-4">
      <SkeletonBox className="w-14 h-14 rounded-2xl" />
      <SkeletonBox className="h-5 w-3/4" />
      <SkeletonBox className="h-4 w-full" />
      <SkeletonBox className="h-4 w-4/5" />
    </div>
  );
}

export function TeamCardSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBox className="aspect-[3/4] rounded-3xl" />
      <SkeletonBox className="h-5 w-2/3" />
      <SkeletonBox className="h-4 w-1/2" />
    </div>
  );
}
