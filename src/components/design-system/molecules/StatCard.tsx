import { cn } from '@/lib/utils'

type TrendDirection = 'up' | 'down' | 'flat'

interface StatCardProps {
  label: string
  value: string | number
  trend?: { direction: TrendDirection; label: string }
  className?: string
}

const trendConfig: Record<TrendDirection, { classes: string; icon: string }> = {
  up: {
    classes: 'text-primary-container bg-primary-container/10',
    icon: '↑',
  },
  down: {
    classes: 'text-destructive bg-destructive/10',
    icon: '↓',
  },
  flat: {
    classes: 'text-outline bg-surface-container-high',
    icon: '—',
  },
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  const trend_cfg = trend ? trendConfig[trend.direction] : null

  return (
    <div
      className={cn(
        'bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10',
        className
      )}
    >
      <p className="text-xs font-label uppercase tracking-widest text-outline">{label}</p>
      <div className="flex items-end justify-between mt-2">
        <h4 className="text-3xl font-headline font-bold text-on-surface">{value}</h4>
        {trend_cfg && trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
              trend_cfg.classes
            )}
          >
            <span className="text-sm">{trend_cfg.icon}</span>
            {trend.label}
          </div>
        )}
      </div>
    </div>
  )
}
