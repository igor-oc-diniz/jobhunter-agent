'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { ApplicationDetail } from './ApplicationDetail'
import { ApplicationCard } from './ApplicationCard'
import { subscribeApplications, updateApplicationStatus } from '@/lib/firestore/applications'
import type { Application, ApplicationStatus } from '@/types'

const COLUMNS: { id: ApplicationStatus; title: string }[] = [
  { id: 'applied', title: 'Applied' },
  { id: 'screening', title: 'Screening' },
  { id: 'interview_hr', title: 'HR Interview' },
  { id: 'interview_tech', title: 'Tech Interview' },
  { id: 'offer', title: 'Offer' },
  { id: 'hired', title: 'Hired' },
  { id: 'rejected', title: 'Rejected' },
]

interface KanbanBoardProps {
  userId: string
}

export function KanbanBoard({ userId }: KanbanBoardProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [activeApp, setActiveApp] = useState<Application | null>(null)

  useEffect(() => {
    const unsub = subscribeApplications(userId, setApplications)
    return unsub
  }, [userId])

  function getColumnApps(status: ApplicationStatus) {
    const base = applications.filter((a) => a.status === status)
    if (status === 'applied') {
      const pending = applications.filter((a) => a.status === 'awaiting_confirmation')
      return [...pending, ...base]
    }
    return base
  }

  function handleDragStart(event: DragStartEvent) {
    const app = applications.find((a) => a.jobId === event.active.id)
    setActiveApp(app ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const targetStatus = over.id as ApplicationStatus
    const app = applications.find((a) => a.jobId === active.id)
    if (!app || app.status === targetStatus) return

    await updateApplicationStatus(userId, app.jobId, targetStatus, targetStatus)
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground text-sm">No applications yet.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Set up your profile and start the agent to see applications here.
        </p>
      </div>
    )
  }

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              applications={getColumnApps(col.id)}
              onCardClick={setSelectedApp}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApp && (
            <ApplicationCard application={activeApp} onClick={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      <ApplicationDetail
        application={selectedApp}
        userId={userId}
        onClose={() => setSelectedApp(null)}
      />
    </>
  )
}
