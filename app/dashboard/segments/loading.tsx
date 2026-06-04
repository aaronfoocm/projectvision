import { SegmentTableSkeleton } from '@/components/ui/Skeleton'

export default function SegmentsLoading() {
  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <div className="h-7 w-28 bg-stone-800 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-stone-800/60 rounded-lg animate-pulse mt-2" />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-10 w-28 bg-stone-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-16 bg-stone-900 border border-stone-800 rounded-xl animate-pulse mb-6" />
      <SegmentTableSkeleton />
    </div>
  )
}
