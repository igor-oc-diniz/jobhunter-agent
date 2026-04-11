'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { getApplicationsAction, updateApplicationStatusAction } from '@/app/actions/applications'
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

export function KanbanBoard({ userId: _userId }: KanbanBoardProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [activeApp, setActiveApp] = useState<Application | null>(null)

  const fetchApplications = useCallback(async () => {
    try {
      const apps = await getApplicationsAction()
      setApplications(apps)
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
    // Poll every 30s for near real-time updates
    const interval = setInterval(fetchApplications, 30_000)
    return () => clearInterval(interval)
  }, [fetchApplications])

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

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.jobId === active.id ? { ...a, status: targetStatus } : a))
    )

    try {
      await updateApplicationStatusAction(app.jobId, targetStatus)
    } catch {
      // Revert on failure
      fetchApplications()
    }
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
        userId={_userId}
        onClose={() => setSelectedApp(null)}
      />
    </>
  )
}
