import { cn } from '@/lib/utils'

type NotificationVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'muted'

const variantClasses: Record<NotificationVariant, string> = {
  success: 'border-primary-container',
  warning: 'border-tertiary-fixed-dim',
  error: 'border-destructive',
  info: 'border-secondary',
  neutral: 'border-on-surface',
  muted: 'border-outline opacity-70',
}

interface NotificationItemProps {
  title: string
  description: string
  timestamp: string
  variant?: NotificationVariant
  className?: string
}

export function NotificationItem({
  title,
  description,
  timestamp,
  variant = 'neutral',
  className,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        'bg-surface-container-low p-4 rounded-[1rem] border-l-2 flex items-center gap-4',
        variantClasses[variant],
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant truncate">{description}</p>
      </div>
      <span className="text-[10px] text-outline shrink-0">{timestamp}</span>
    </div>
  )
}
