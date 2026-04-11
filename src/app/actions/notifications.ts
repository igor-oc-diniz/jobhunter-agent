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

  // NOTE: Combining where('read') + orderBy('createdAt') requires a composite
  // index. To avoid the index requirement we fetch without orderBy and sort
  // in memory when filtering by read status.
  let query = adminDb
    .collection(`users/${userId}/notifications`)
    .limit(20) as FirebaseFirestore.Query

  if (onlyUnread) {
    query = query.where('read', '==', false)
  } else {
    query = query.orderBy('createdAt', 'desc')
  }

  const snap = await query.get()
  return snap.docs
    .map((d) => {
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
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
