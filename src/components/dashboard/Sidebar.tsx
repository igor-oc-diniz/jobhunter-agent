'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Kanban, BarChart2, User, Bot, Settings } from 'lucide-react'
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
    <aside className="w-56 flex flex-col shrink-0 bg-surface-container-low border-r border-outline-variant/15">
      {/* Brand */}
      <div className="p-5 border-b border-outline-variant/15">
        <span className="font-headline text-lg font-bold tracking-tighter text-on-surface">
          Huntly
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[1rem] text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary-container/10 text-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  active ? 'text-primary-container' : 'text-on-surface-variant'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer hint */}
      <div className="p-4 border-t border-outline-variant/15">
        <p className="text-[10px] font-label uppercase tracking-widest text-outline">
          Mission Control
        </p>
      </div>
    </aside>
  )
}
