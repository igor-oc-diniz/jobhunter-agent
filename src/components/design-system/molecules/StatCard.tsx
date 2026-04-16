import { useState } from 'react'
import { cn } from '@/lib/utils'

type TrendDirection = 'up' | 'down' | 'flat'

interface StatCardProps {
  label: string
  value: string | number
  tooltip?: string
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

export function StatCard({ label, value, tooltip, trend, className }: StatCardProps) {
  const trend_cfg = trend ? trendConfig[trend.direction] : null
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className={cn(
        'bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10 relative',
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-label uppercase tracking-widest text-outline">{label}</p>
        {tooltip && (
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="w-3.5 h-3.5 rounded-full border border-outline/40 text-outline flex items-center justify-center text-[9px] font-bold hover:border-on-surface-variant hover:text-on-surface-variant transition-colors"
              aria-label="More info"
            >
              ?
            </button>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 bg-surface-container-highest border border-outline-variant/20 rounded-[1rem] px-3 py-2 shadow-neon pointer-events-none">
                <p className="text-[11px] text-on-surface-variant leading-relaxed">{tooltip}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-highest" />
              </div>
            )}
          </div>
        )}
      </div>
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
