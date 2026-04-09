import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  className?: string
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const color =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 60
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
        color,
        className
      )}
    >
      {score}%
    </span>
  )
}
