'use client'

import { useAuth } from '@/hooks/useAuth'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'

export default function ApplicationsPage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Applications</h1>
      </div>
      <KanbanBoard userId={user.uid} />
    </div>
  )
}
