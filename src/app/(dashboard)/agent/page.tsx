import { requireUserId } from '@/lib/auth/server'
import { AgentPanel } from '@/components/dashboard/AgentPanel'

export default async function AgentPage() {
  await requireUserId()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface">
          Agent
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Monitor status, review run logs, and trigger manual cycles.
        </p>
      </div>
      <AgentPanel />
    </div>
  )
}
