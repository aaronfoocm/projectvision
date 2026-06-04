import { CustomerCardSkeleton } from '@/components/ui/Skeleton'

export default function CustomersLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-7 w-32 bg-stone-800 rounded-lg animate-pulse" />
        <div className="h-4 w-24 bg-stone-800/60 rounded-lg animate-pulse mt-2" />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="h-9 flex-1 min-w-[240px] bg-stone-800 rounded-lg animate-pulse" />
        <div className="flex gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-stone-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <CustomerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
