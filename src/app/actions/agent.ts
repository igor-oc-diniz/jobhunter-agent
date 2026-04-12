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

export async function triggerAgentRunAction(): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId()

  const agentUrl = process.env.AGENT_URL
  if (!agentUrl) {
    return { ok: false, error: 'AGENT_URL not configured' }
  }

  const res = await fetch(`${agentUrl}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AGENT_SECRET ? { 'x-agent-secret': process.env.AGENT_SECRET } : {}),
    },
    body: JSON.stringify({ userId }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Agent returned ${res.status}: ${text}` }
  }

  return { ok: true }
}
