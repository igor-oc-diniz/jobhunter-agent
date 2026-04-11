'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Wifi } from 'lucide-react'
import { ScoreBadge, StatusBeacon, Chip } from '@/components/design-system'
import { cn } from '@/lib/utils'
import type { Application } from '@/types'

interface ApplicationCardProps {
  application: Application
  onClick: () => void
}

export function ApplicationCard({ application, onClick }: ApplicationCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: application.jobId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isAwaitingConfirmation = application.status === 'awaiting_confirmation'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-surface-container-low p-4 rounded-[1.5rem] border border-outline-variant/10 cursor-pointer select-none',
        'hover:scale-[1.02] hover:border-primary-container/20 hover:shadow-neon transition-all duration-200',
        isDragging && 'opacity-50 rotate-2 border-dashed',
        isAwaitingConfirmation && 'border-l-4 border-l-tertiary-fixed-dim/80'
      )}
    >
      {isAwaitingConfirmation && (
        <div className="flex items-center gap-1.5 text-tertiary-fixed-dim text-xs font-bold uppercase tracking-widest mb-3">
          <StatusBeacon variant="pending" pulse />
          Awaiting Confirmation
        </div>
      )}

      {/* Title + Score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-headline font-semibold text-sm text-on-surface truncate">
            {application.jobSnapshot.title}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {application.jobSnapshot.company}
          </p>
        </div>
        <ScoreBadge score={application.matchScore} size="sm" />
      </div>

      {/* Location / Remote */}
      <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-2">
        {application.jobSnapshot.isRemote ? (
          <span className="flex items-center gap-1">
            <Wifi className="w-3 h-3" /> Remote
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {application.jobSnapshot.location}
          </span>
        )}
        {application.jobSnapshot.salaryMax && (
          <span>R$ {(application.jobSnapshot.salaryMax / 1000).toFixed(0)}k</span>
        )}
      </div>

      {/* Tech stack chips */}
      {application.jobSnapshot.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {application.jobSnapshot.techStack.slice(0, 3).map((tech) => (
            <Chip key={tech} label={tech} />
          ))}
          {application.jobSnapshot.techStack.length > 3 && (
            <span className="text-[10px] text-on-surface-variant self-center">
              +{application.jobSnapshot.techStack.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
