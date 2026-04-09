import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/client'
import type { Notification } from '@/types'

export const notificationsRef = (userId: string) =>
  collection(getDb(), 'users', userId, 'notifications')

export function subscribeNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      notificationsRef(userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    ),
    (snap) =>
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
    )
  )
}

export async function markAsRead(userId: string, notifId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId, 'notifications', notifId), {
    read: true,
  })
}

export async function markAllAsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(notificationsRef(userId), where('read', '==', false))
  )
  if (snap.empty) return

  const batch = writeBatch(getDb())
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}
