'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentStatusBadge } from './AgentStatusBadge'

export function Topbar() {
  return (
    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <AgentStatusBadge />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
