import { cn } from '@/lib/utils'
import { StatusBeacon } from './StatusBeacon'
import type { ApplicationStatus } from '@/types'

interface StatusConfig {
  label: string
  classes: string
  beacon?: 'success' | 'pending' | 'error' | 'info' | 'muted'
  pulse?: boolean
}

const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  queued: {
    label: 'Queued',
    classes: 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/20',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-secondary-container/10 text-secondary border-secondary/20',
    beacon: 'info',
    pulse: true,
  },
  awaiting_confirmation: {
    label: 'Awaiting',
    classes: 'bg-tertiary-fixed/10 text-tertiary-fixed-dim border-tertiary-fixed-dim/20',
    beacon: 'pending',
    pulse: true,
  },
  applied: {
    label: 'Applied',
    classes: 'bg-primary-container/10 text-primary-container border-primary-container/20',
    beacon: 'success',
  },
  viewed: {
    label: 'Viewed',
    classes: 'bg-primary-fixed/10 text-primary-fixed-dim border-primary-fixed-dim/20',
  },
  screening: {
    label: 'Screening',
    classes: 'bg-secondary-container/10 text-secondary border-secondary/20',
  },
  interview_hr: {
    label: 'HR Interview',
    classes: 'bg-tertiary-container/10 text-on-tertiary-container border-tertiary-fixed-dim/20',
  },
  interview_tech: {
    label: 'Tech Interview',
    classes: 'bg-primary-fixed/10 text-primary-fixed-dim border-primary-fixed-dim/20',
  },
  offer: {
    label: 'Offer',
    classes: 'bg-primary-container text-on-primary border-primary-container',
    beacon: 'success',
  },
  hired: {
    label: 'Hired',
    classes: 'bg-inverse-primary text-primary border-primary/20',
    beacon: 'success',
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-error-container/20 text-destructive border-destructive/20',
    beacon: 'error',
  },
  withdrawn: {
    label: 'Withdrawn',
    classes: 'bg-surface-container-highest/50 text-on-surface/50 border-outline-variant/20',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-error-container/20 text-destructive border-destructive/30',
    beacon: 'error',
  },
}

interface StatusBadgeProps {
  status: ApplicationStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
        config.classes,
        className
      )}
    >
      {config.beacon && (
        <StatusBeacon variant={config.beacon} pulse={config.pulse} />
      )}
      {config.label}
    </span>
  )
}
