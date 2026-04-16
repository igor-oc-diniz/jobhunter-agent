'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBeacon } from '@/components/design-system'
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type SerializedNotification,
} from '@/app/actions/notifications'
import type { NotificationType } from '@/types'

const TYPE_VARIANT: Record<
  NotificationType,
  { beacon: 'success' | 'pending' | 'error' | 'info' | 'muted'; borderClass: string }
> = {
  application_sent: { beacon: 'success', borderClass: 'border-primary-container' },
  awaiting_confirmation: { beacon: 'pending', borderClass: 'border-tertiary-fixed-dim' },
  captcha_detected: { beacon: 'info', borderClass: 'border-secondary' },
  application_failed: { beacon: 'error', borderClass: 'border-destructive' },
  daily_limit_reached: { beacon: 'muted', borderClass: 'border-outline' },
  cycle_completed: { beacon: 'info', borderClass: 'border-secondary-container' },
  interview_reminder: { beacon: 'success', borderClass: 'border-on-surface' },
  platform_blocked: { beacon: 'error', borderClass: 'border-destructive' },
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<SerializedNotification[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotificationsAction(true)
      setNotifications(data)
    } catch {
      // Silently ignore — notification center is non-critical
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleMarkRead(id: string) {
    await markNotificationReadAction(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleMarkAll() {
    await markAllNotificationsReadAction()
    setNotifications([])
  }

  const unreadCount = notifications.length

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary-container rounded-full transition-all"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary-container shadow-[0_0_6px_rgba(0,255,136,0.6)]" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-96 glass-panel rounded-[1.5rem] shadow-neon border border-outline-variant/15 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
            <span className="text-[10px] font-label uppercase tracking-widest text-outline">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-primary-container/10 text-primary-container rounded text-[9px]">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[10px] font-label uppercase tracking-wider text-on-surface-variant hover:text-primary-container transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[10px] font-label uppercase tracking-widest text-outline">
                  All caught up
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {notifications.map((n) => {
                  const cfg = TYPE_VARIANT[n.type] ?? { beacon: 'muted', borderClass: 'border-outline' }
                  return (
                    <div
                      key={n.id}
                      className={`bg-surface-container-low p-4 rounded-[1rem] border-l-2 flex items-start gap-3 ${cfg.borderClass}`}
                    >
                      <StatusBeacon variant={cfg.beacon} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface">{n.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-outline mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 p-1 text-outline hover:text-primary-container transition-colors rounded"
                        title="Mark as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
