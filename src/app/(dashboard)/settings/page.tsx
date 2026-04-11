import { requireUserId } from '@/lib/auth/server'
import { getAgentConfigAction } from '@/app/actions/settings'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
import type { AgentConfig } from '@/types'

const DEFAULT_CONFIG: AgentConfig = {
  mode: 'semi-automatic',
  minScore: 70,
  maxApplicationsPerDay: 10,
  enabledPlatforms: ['linkedin', 'gupy', 'indeed'],
  searchKeywords: [],
  excludeKeywords: [],
  scheduleHours: [9, 12, 18],
  emailNotifications: true,
}

export default async function SettingsPage() {
  await requireUserId()
  const config = await getAgentConfigAction()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface">
          Settings
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Configure how the agent searches, scores, and applies.
        </p>
      </div>
      <SettingsForm initialConfig={config ?? DEFAULT_CONFIG} />
    </div>
  )
}
