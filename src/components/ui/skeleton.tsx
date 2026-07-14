interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-100 rounded-md ${className}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-16 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24 ml-auto" />
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div>
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
