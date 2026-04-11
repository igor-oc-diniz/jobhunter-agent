import { cn } from '@/lib/utils'

type BeaconVariant = 'success' | 'pending' | 'error' | 'info' | 'muted'

const variantClasses: Record<BeaconVariant, string> = {
  success: 'bg-primary-container shadow-[0_0_8px_rgba(0,255,136,0.5)]',
  pending: 'bg-tertiary-fixed-dim',
  error: 'bg-destructive',
  info: 'bg-secondary-container',
  muted: 'bg-outline',
}

interface StatusBeaconProps {
  variant?: BeaconVariant
  pulse?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBeacon({
  variant = 'muted',
  pulse = false,
  size = 'sm',
  className,
}: StatusBeaconProps) {
  return (
    <span
      className={cn(
        'rounded-full inline-block shrink-0',
        size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
        variantClasses[variant],
        pulse && 'animate-pulse',
        className
      )}
    />
  )
}
