'use client'

import { useAuth } from '@/hooks/useAuth'
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard'

export default function AnalyticsPage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <AnalyticsDashboard userId={user.uid} />
    </div>
  )
}
