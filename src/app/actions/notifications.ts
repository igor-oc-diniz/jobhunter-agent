'use server'

import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { Notification, NotificationType } from '@/types'

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString()
  if (typeof val === 'string') return val
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

export interface SerializedNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  actionUrl?: string
  relatedJobId?: string
  createdAt: string
}

export async function getNotificationsAction(onlyUnread = true): Promise<SerializedNotification[]> {
  const userId = await requireUserId()
  let query = adminDb
    .collection(`users/${userId}/notifications`)
    .orderBy('createdAt', 'desc')
    .limit(20) as FirebaseFirestore.Query

  if (onlyUnread) {
    query = query.where('read', '==', false)
  }

  const snap = await query.get()
  return snap.docs.map((d) => {
    const raw = d.data()
    return {
      id: d.id,
      userId,
      type: raw.type as NotificationType,
      title: raw.title ?? '',
      message: raw.message ?? '',
      read: raw.read ?? false,
      actionUrl: raw.actionUrl,
      relatedJobId: raw.relatedJobId,
      createdAt: toIso(raw.createdAt),
    }
  })
}

export async function markNotificationReadAction(notifId: string): Promise<void> {
  const userId = await requireUserId()
  await adminDb
    .doc(`users/${userId}/notifications/${notifId}`)
    .update({ read: true })
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId()
  const snap = await adminDb
    .collection(`users/${userId}/notifications`)
    .where('read', '==', false)
    .get()

  if (snap.empty) return

  const batch = adminDb.batch()
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}
