'use client'

import { cn } from '@/lib/utils'

type AgentStatus = 'idle' | 'running' | 'blocked' | 'error' | 'paused'

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: 'Agent idle', color: 'bg-muted-foreground' },
  running: { label: 'Agent running', color: 'bg-green-500' },
  blocked: { label: 'Awaiting confirmation', color: 'bg-yellow-500' },
  error: { label: 'Agent error', color: 'bg-destructive' },
  paused: { label: 'Agent paused', color: 'bg-muted-foreground' },
}

interface AgentStatusBadgeProps {
  status?: AgentStatus
}

export function AgentStatusBadge({ status = 'idle' }: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('w-2 h-2 rounded-full', config.color, status === 'running' && 'animate-pulse')} />
      <span className="text-muted-foreground">{config.label}</span>
    </div>
  )
}
