'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { AgentStatusBadge } from './AgentStatusBadge'
import { onAuthChange } from '@/lib/firebase/auth'
import type { User } from 'firebase/auth'

export function Topbar() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsub = onAuthChange(setUser)
    return unsub
  }, [])

  return (
    <header className="h-14 flex items-center justify-between px-6 shrink-0 bg-background/60 backdrop-blur-xl border-b border-outline-variant/15 shadow-neon">
      <AgentStatusBadge />

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary-container rounded-full transition-all">
          <Bell className="w-4 h-4" />
        </button>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className="w-7 h-7 rounded-full border border-outline-variant/30"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-xs font-headline font-bold text-on-surface-variant">
                {user.displayName?.[0] ?? user.email?.[0] ?? '?'}
              </div>
            )}
            <span className="text-sm text-on-surface-variant hidden sm:block">
              {user.displayName ?? user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
