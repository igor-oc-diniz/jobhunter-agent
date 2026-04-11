import { requireUserId } from '@/lib/auth/server'
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard'

export default async function AnalyticsPage() {
  await requireUserId()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface">
          Analytics
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Application funnel, platform breakdown, and tech demand.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  )
}
