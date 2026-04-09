'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format, subDays, startOfWeek, isAfter } from 'date-fns'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApplications } from '@/lib/firestore/applications'
import type { Application } from '@/types'

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

const PERIOD_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

interface AnalyticsDashboardProps {
  userId: string
}

export function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [periodDays, setPeriodDays] = useState(30)

  useEffect(() => {
    getApplications(userId).then(setApplications)
  }, [userId])

  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), periodDays)
    return applications.filter((a) => {
      const date = (a.appliedAt as any)?.toDate?.()
      return date ? isAfter(date, cutoff) : true
    })
  }, [applications, periodDays])

  // Summary cards
  const total = filtered.length
  const active = filtered.filter((a) =>
    ['screening', 'interview_hr', 'interview_tech', 'offer'].includes(a.status)
  ).length
  const returnRate = total
    ? Math.round((filtered.filter((a) => a.status !== 'applied').length / total) * 100)
    : 0
  const avgScore = total
    ? Math.round(filtered.reduce((s, a) => s + a.matchScore, 0) / total)
    : 0

  // Applications per week
  const byWeek = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((a) => {
      const date = (a.appliedAt as any)?.toDate?.()
      if (!date) return
      const week = format(startOfWeek(date), 'MMM d')
      map.set(week, (map.get(week) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([week, count]) => ({ week, count }))
      .slice(-8)
  }, [filtered])

  // Funnel
  const funnelStages = [
    { name: 'Applied', count: filtered.filter((a) => a.status !== 'queued').length },
    { name: 'Screening', count: filtered.filter((a) => ['screening', 'interview_hr', 'interview_tech', 'offer', 'hired'].includes(a.status)).length },
    { name: 'Interview', count: filtered.filter((a) => ['interview_hr', 'interview_tech', 'offer', 'hired'].includes(a.status)).length },
    { name: 'Offer', count: filtered.filter((a) => ['offer', 'hired'].includes(a.status)).length },
    { name: 'Hired', count: filtered.filter((a) => a.status === 'hired').length },
  ]

  // By platform
  const byPlatform = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((a) => {
      const p = a.jobSnapshot.sourcePlatform
      map.set(p, (map.get(p) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Top tech stack
  const techFreq = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((a) =>
      a.jobSnapshot.techStack.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1))
    )
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [filtered])

  function exportCsv() {
    const rows = [
      ['Company', 'Role', 'Status', 'Score', 'Platform', 'Applied At', 'Salary Max'],
      ...filtered.map((a) => [
        a.jobSnapshot.company,
        a.jobSnapshot.title,
        a.status,
        a.matchScore,
        a.jobSnapshot.sourcePlatform,
        (a.appliedAt as any)?.toDate?.()
          ? format((a.appliedAt as any).toDate(), 'yyyy-MM-dd')
          : '',
        a.jobSnapshot.salaryMax ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applications-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-2">
        {PERIOD_OPTIONS.map((o) => (
          <button
            key={o.days}
            onClick={() => setPeriodDays(o.days)}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              periodDays === o.days
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total applications', value: total },
          { label: 'Return rate', value: `${returnRate}%` },
          { label: 'Active processes', value: active },
          { label: 'Average score', value: `${avgScore}%` },
        ].map((card) => (
          <div key={card.label} className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">
          No applications in the selected period.
        </p>
      )}

      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Applications per week */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-4">Applications per week</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion funnel */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-4">Conversion funnel</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelStages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By platform */}
          {byPlatform.length > 0 && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-4">By platform</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byPlatform}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {byPlatform.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top tech stack */}
          {techFreq.length > 0 && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-4">Most demanded tech</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={techFreq}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
