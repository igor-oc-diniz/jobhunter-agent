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
import { StatCard } from '@/components/design-system'
import { getApplicationsAction } from '@/app/actions/applications'
import type { Application } from '@/types'

const PIE_COLORS = ['#00ff88', '#00e0ff', '#d0bcff', '#60ff99', '#ffb4ab', '#00daf8']

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#201f1f',
  border: '1px solid rgba(59,75,61,0.15)',
  borderRadius: '1rem',
  color: '#e5e2e1',
  fontSize: 12,
}

const PERIOD_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export function AnalyticsDashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [periodDays, setPeriodDays] = useState(30)

  useEffect(() => {
    getApplicationsAction().then(setApplications).catch(console.error)
  }, [])

  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), periodDays)
    return applications.filter((a) => {
      if (!a.appliedAt) return true
      return isAfter(new Date(a.appliedAt as string | number), cutoff)
    })
  }, [applications, periodDays])

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

  const byWeek = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((a) => {
      if (!a.appliedAt) return
      const date = new Date(a.appliedAt as string | number)
      const week = format(startOfWeek(date), 'MMM d')
      map.set(week, (map.get(week) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([week, count]) => ({ week, count }))
      .slice(-8)
  }, [filtered])

  const funnelStages = [
    { name: 'Applied', count: filtered.filter((a) => a.status !== 'queued').length },
    { name: 'Screening', count: filtered.filter((a) => ['screening', 'interview_hr', 'interview_tech', 'offer', 'hired'].includes(a.status)).length },
    { name: 'Interview', count: filtered.filter((a) => ['interview_hr', 'interview_tech', 'offer', 'hired'].includes(a.status)).length },
    { name: 'Offer', count: filtered.filter((a) => ['offer', 'hired'].includes(a.status)).length },
    { name: 'Hired', count: filtered.filter((a) => a.status === 'hired').length },
  ]

  const byPlatform = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((a) => {
      const p = a.jobSnapshot.sourcePlatform
      map.set(p, (map.get(p) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

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
        a.appliedAt ? format(new Date(a.appliedAt as string | number), 'yyyy-MM-dd') : '',
        a.jobSnapshot.salaryMax ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `applications-${format(new Date(), 'yyyy-MM-dd')}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Period filter */}
        <div className="flex items-center gap-2 glass-panel p-1 rounded-[1rem]">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setPeriodDays(o.days)}
              className={
                periodDays === o.days
                  ? 'px-4 py-1.5 rounded-[0.75rem] text-xs font-bold font-label uppercase tracking-wider bg-primary-container text-on-primary transition-all'
                  : 'px-4 py-1.5 rounded-[0.75rem] text-xs font-bold font-label uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-all'
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={exportCsv}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-[1rem] border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-xs font-bold font-label uppercase tracking-wider transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={total} />
        <StatCard label="Return Rate" value={`${returnRate}%`} />
        <StatCard label="Active Processes" value={active} />
        <StatCard label="Average Score" value={`${avgScore}%`} />
      </div>

      {total === 0 && (
        <p className="text-center text-on-surface-variant text-sm py-12 font-label uppercase tracking-widest">
          No applications in the selected period
        </p>
      )}

      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Applications per week */}
          <div className="bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10">
            <p className="text-xs font-label uppercase tracking-widest text-outline mb-4">
              Applications per week
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,75,61,0.2)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#b9cbb9' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#b9cbb9' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="count" stroke="#00ff88" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion funnel */}
          <div className="bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10">
            <p className="text-xs font-label uppercase tracking-widest text-outline mb-4">
              Conversion funnel
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelStages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,75,61,0.2)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#b9cbb9' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#b9cbb9' }} width={70} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#00ff88" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By platform */}
          {byPlatform.length > 0 && (
            <div className="bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10">
              <p className="text-xs font-label uppercase tracking-widest text-outline mb-4">
                By platform
              </p>
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
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top tech stack */}
          {techFreq.length > 0 && (
            <div className="bg-surface-container-low p-6 rounded-[1.5rem] border border-outline-variant/10">
              <p className="text-xs font-label uppercase tracking-widest text-outline mb-4">
                Most demanded tech
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={techFreq}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,75,61,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#b9cbb9' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#b9cbb9' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="#d0bcff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
