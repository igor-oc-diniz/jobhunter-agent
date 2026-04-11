'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <AgentStatusBadge />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Bell className="w-4 h-4" />
        </Button>
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {user.displayName?.[0] ?? user.email?.[0] ?? '?'}
              </div>
            )}
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.displayName ?? user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
