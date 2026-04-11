'use server'

import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { AgentStatus, AgentRunLog } from '@/types'

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString()
  if (typeof val === 'string') return val
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

export async function getAgentStatusAction(): Promise<AgentStatus> {
  const userId = await requireUserId()
  const snap = await adminDb.doc(`users/${userId}/agentStatus/current`).get()

  if (!snap.exists) {
    return { status: 'idle', updatedAt: new Date().toISOString() }
  }

  const raw = snap.data()!
  return {
    status: raw.status ?? 'idle',
    lastRunAt: toIso(raw.lastRunAt),
    nextRunAt: raw.nextRunAt ? toIso(raw.nextRunAt) : undefined,
    currentJob: raw.currentJob ?? undefined,
    updatedAt: toIso(raw.updatedAt),
  }
}

export async function getAgentLogsAction(limit = 5): Promise<AgentRunLog[]> {
  const userId = await requireUserId()
  const snap = await adminDb
    .collection(`users/${userId}/agentLogs`)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get()

  return snap.docs.map((d) => {
    const raw = d.data()
    return {
      runId: d.id,
      userId,
      startedAt: toIso(raw.startedAt),
      finishedAt: raw.finishedAt ? toIso(raw.finishedAt) : undefined,
      status: raw.status ?? 'completed',
      applicationsProcessed: raw.applicationsProcessed ?? 0,
      applicationsSubmitted: raw.applicationsSubmitted ?? 0,
      errors: raw.errors ?? 0,
      entries: raw.entries ?? [],
    } as AgentRunLog
  })
}

export async function triggerAgentRunAction(): Promise<{ ok: boolean }> {
  const userId = await requireUserId()
  await adminDb.doc(`users/${userId}/agentStatus/current`).set(
    {
      status: 'running',
      triggeredManually: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
  return { ok: true }
}
