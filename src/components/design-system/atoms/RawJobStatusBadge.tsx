import { cn } from '@/lib/utils'
import { StatusBeacon } from './StatusBeacon'
import type { RawJob } from '@/types'

type RawJobStatus = RawJob['status']

interface StatusConfig {
  label: string
  classes: string
  beacon?: 'success' | 'pending' | 'error' | 'info' | 'muted'
  pulse?: boolean
}

const STATUS_CONFIG: Record<RawJobStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    classes: 'bg-tertiary-fixed/10 text-tertiary-fixed-dim border-tertiary-fixed-dim/20',
    beacon: 'pending',
    pulse: true,
  },
  matched: {
    label: 'Matched',
    classes: 'bg-primary-container/10 text-primary-container border-primary-container/20',
    beacon: 'success',
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-error/10 text-error border-error/20',
    beacon: 'error',
  },
  applied: {
    label: 'Applied',
    classes: 'bg-secondary-container/10 text-secondary-container border-secondary-container/20',
    beacon: 'info',
  },
  error: {
    label: 'Error',
    classes: 'bg-error-container/20 text-error border-error/10',
    beacon: 'error',
  },
}

interface RawJobStatusBadgeProps {
  status: RawJobStatus
  className?: string
}

export function RawJobStatusBadge({ status, className }: RawJobStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
        config.classes,
        className
      )}
    >
      {config.beacon && <StatusBeacon variant={config.beacon} pulse={config.pulse} />}
      {config.label}
    </span>
  )
}
