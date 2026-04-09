'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ApplicationCard } from './ApplicationCard'
import { cn } from '@/lib/utils'
import type { Application } from '@/types'

interface KanbanColumnProps {
  id: string
  title: string
  applications: Application[]
  onCardClick: (application: Application) => void
}

export function KanbanColumn({ id, title, applications, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex flex-col min-w-[260px] max-w-[280px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {applications.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors',
          isOver ? 'bg-primary/5 border-2 border-dashed border-primary/30' : 'bg-muted/30'
        )}
      >
        <SortableContext
          items={applications.map((a) => a.jobId)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((app) => (
            <ApplicationCard
              key={app.jobId}
              application={app}
              onClick={() => onCardClick(app)}
            />
          ))}
        </SortableContext>

        {applications.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            No applications
          </div>
        )}
      </div>
    </div>
  )
}
