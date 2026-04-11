import { cn } from '@/lib/utils'

interface ScoreConfig {
  label: string
  ringClass: string
  textClass: string
  shadowClass?: string
}

function getScoreConfig(score: number): ScoreConfig {
  if (score >= 90) {
    return {
      label: 'Sentinel',
      ringClass: 'border-primary-container',
      textClass: 'text-primary-container',
      shadowClass: 'shadow-[0px_0px_40px_rgba(0,255,136,0.3)]',
    }
  }
  if (score >= 80) {
    return {
      label: 'Expert',
      ringClass: 'border-primary-container/60',
      textClass: 'text-primary-container',
      shadowClass: 'shadow-[0px_0px_30px_rgba(0,255,136,0.2)]',
    }
  }
  if (score >= 65) {
    return {
      label: 'Strong',
      ringClass: 'border-primary-fixed-dim/40',
      textClass: 'text-primary-fixed-dim',
      shadowClass: 'shadow-[0px_0px_20px_rgba(0,228,121,0.1)]',
    }
  }
  if (score >= 50) {
    return {
      label: 'Potential',
      ringClass: 'border-secondary/30',
      textClass: 'text-secondary',
    }
  }
  return {
    label: 'Low',
    ringClass: 'border-outline-variant/30',
    textClass: 'text-on-surface-variant',
  }
}

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ScoreBadge({ score, size = 'sm', className }: ScoreBadgeProps) {
  const config = getScoreConfig(score)

  if (size === 'sm') {
    // Inline compact version (for kanban cards)
    return (
      <span
        className={cn(
          'font-headline font-bold text-sm tabular-nums',
          config.textClass,
          className
        )}
      >
        {score}%
      </span>
    )
  }

  const sizeClasses = size === 'lg' ? 'w-20 h-20 text-xl' : 'w-14 h-14 text-base'

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full border-2 flex items-center justify-center',
          sizeClasses,
          config.ringClass,
          config.shadowClass,
          score >= 90 && 'bg-primary-container/10'
        )}
      >
        <span className={cn('font-headline font-bold tabular-nums', config.textClass)}>
          {score}%
        </span>
      </div>
      <span className={cn('text-[10px] font-label uppercase tracking-widest', config.textClass)}>
        {config.label}
      </span>
    </div>
  )
}
