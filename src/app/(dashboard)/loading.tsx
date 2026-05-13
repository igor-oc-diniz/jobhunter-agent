export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-surface-container-high" />
      <div className="h-4 w-72 rounded-xl bg-surface-container-high" />
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-container-high" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-container-high" />
        ))}
      </div>
    </div>
  )
}
