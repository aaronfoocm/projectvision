export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-stone-800 animate-pulse rounded-lg ${className}`}
      aria-hidden="true"
    />
  )
}

export function SegmentTableSkeleton() {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="divide-y divide-stone-800/50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3">
            <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full ml-2" />
            <div className="ml-auto flex items-center gap-8">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CustomerCardSkeleton() {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-10 rounded-md" />
      </div>
      <Skeleton className="h-3 w-20 mt-2.5" />
    </div>
  )
}
