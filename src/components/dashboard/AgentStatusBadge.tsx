'use client'

import { StatusBeacon } from '@/components/design-system'
import { cn } from '@/lib/utils'

type AgentStatus = 'idle' | 'running' | 'blocked' | 'error' | 'paused'

const statusConfig: Record<
  AgentStatus,
  { label: string; beacon: 'success' | 'pending' | 'error' | 'info' | 'muted'; pulse: boolean }
> = {
  idle: { label: 'Agent idle', beacon: 'muted', pulse: false },
  running: { label: 'Agent running', beacon: 'success', pulse: true },
  blocked: { label: 'Awaiting confirmation', beacon: 'pending', pulse: true },
  error: { label: 'Agent error', beacon: 'error', pulse: false },
  paused: { label: 'Agent paused', beacon: 'muted', pulse: false },
}

interface AgentStatusBadgeProps {
  status?: AgentStatus
  className?: string
}

export function AgentStatusBadge({ status = 'idle', className }: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StatusBeacon variant={config.beacon} pulse={config.pulse} />
      <span className="text-sm font-label text-on-surface-variant">{config.label}</span>
    </div>
  )
}
