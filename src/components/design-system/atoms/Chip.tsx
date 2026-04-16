import { cn } from '@/lib/utils'

interface ChipProps {
  label: string
  className?: string
}

export function Chip({ label, className }: ChipProps) {
  return (
    <span
      className={cn(
        'px-3 py-1 bg-surface-container-high rounded-full text-[10px] uppercase tracking-tighter text-on-surface-variant font-label',
        className
      )}
    >
      {label}
    </span>
  )
}
