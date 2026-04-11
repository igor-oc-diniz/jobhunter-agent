import { requireUserId } from '@/lib/auth/server'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'

export default async function ApplicationsPage() {
  const userId = await requireUserId()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Applications</h1>
      </div>
      <KanbanBoard userId={userId} />
    </div>
  )
}
