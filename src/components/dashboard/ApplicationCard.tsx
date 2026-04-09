'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Wifi, Clock } from 'lucide-react'
import { ScoreBadge } from './ScoreBadge'
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
        'bg-white border rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow select-none',
        isDragging && 'opacity-50 shadow-lg',
        isAwaitingConfirmation && 'border-yellow-400'
      )}
    >
      {isAwaitingConfirmation && (
        <div className="flex items-center gap-1 text-yellow-600 text-xs font-medium mb-2">
          <Clock className="w-3 h-3" />
          Awaiting confirmation
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{application.jobSnapshot.title}</p>
          <p className="text-xs text-muted-foreground truncate">{application.jobSnapshot.company}</p>
        </div>
        <ScoreBadge score={application.matchScore} />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

      {application.jobSnapshot.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {application.jobSnapshot.techStack.slice(0, 3).map((tech) => (
            <span
              key={tech}
              className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded"
            >
              {tech}
            </span>
          ))}
          {application.jobSnapshot.techStack.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{application.jobSnapshot.techStack.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
