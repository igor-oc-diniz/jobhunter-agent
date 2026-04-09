import type { Timestamp } from 'firebase/firestore'

export type NotificationType =
  | 'application_sent'
  | 'awaiting_confirmation'
  | 'captcha_detected'
  | 'application_failed'
  | 'daily_limit_reached'
  | 'cycle_completed'
  | 'interview_reminder'
  | 'platform_blocked'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  actionUrl?: string
  relatedJobId?: string
  createdAt: Timestamp
  expiresAt?: Timestamp
}
