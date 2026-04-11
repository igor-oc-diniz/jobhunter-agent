'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { AgentConfig } from '@/types'

export async function getAgentConfigAction(): Promise<AgentConfig | null> {
  const userId = await requireUserId()
  const snap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!snap.exists) return null
  return (snap.data()?.agentConfig as AgentConfig) ?? null
}

export async function saveAgentConfigAction(config: AgentConfig): Promise<void> {
  const userId = await requireUserId()
  await adminDb.doc(`users/${userId}/profile/data`).set(
    { agentConfig: config, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}
