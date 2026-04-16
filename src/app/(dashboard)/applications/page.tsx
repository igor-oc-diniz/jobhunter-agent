import { requireUserId } from '@/lib/auth/server'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'

export default async function ApplicationsPage() {
  const userId = await requireUserId()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface">
          Applications
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Track and manage your application pipeline.
        </p>
      </div>
      <KanbanBoard userId={userId} />
    </div>
  )
}
