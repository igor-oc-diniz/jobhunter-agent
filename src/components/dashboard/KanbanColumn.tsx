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
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-label uppercase tracking-widest text-on-surface-variant font-bold">
          {title}
        </h3>
        <span className="text-[10px] text-outline bg-surface-container-high px-2 py-0.5 rounded-full font-bold">
          {applications.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-[200px] rounded-[1.5rem] p-3 transition-colors',
          isOver
            ? 'bg-primary-container/5 border-2 border-dashed border-primary-container/30'
            : 'bg-surface-container-lowest/50'
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
          <div className="flex items-center justify-center h-20 text-[10px] font-label uppercase tracking-widest text-outline">
            Empty
          </div>
        )}
      </div>
    </div>
  )
}
