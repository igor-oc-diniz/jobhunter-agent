'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Kanban,
  BarChart2,
  User,
  Bot,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Applications', href: '/applications', icon: Kanban },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Profile', href: '/profile/edit', icon: User },
  { name: 'Agent', href: '/agent', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r flex flex-col shrink-0">
      <div className="p-4 border-b">
        <span className="font-semibold text-sm">Job Hunter</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navigation.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
