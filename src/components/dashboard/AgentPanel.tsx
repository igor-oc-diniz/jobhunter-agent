'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Play, RefreshCw, Loader2 } from 'lucide-react'
import { StatusBeacon, StatCard } from '@/components/design-system'
import {
  getAgentStatusAction,
  getAgentLogsAction,
  triggerAgentRunAction,
} from '@/app/actions/agent'
import type { AgentStatus, AgentRunLog, AgentLogLevel } from '@/types'

const LOG_LEVEL_CLASSES: Record<AgentLogLevel, string> = {
  info: 'text-on-surface-variant',
  warn: 'text-tertiary-fixed-dim',
  error: 'text-destructive',
  debug: 'text-outline',
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  blocked: 'Awaiting confirmation',
  error: 'Error',
  paused: 'Paused',
}

const STATUS_BEACON: Record<string, 'success' | 'pending' | 'error' | 'muted'> = {
  idle: 'muted',
  running: 'success',
  blocked: 'pending',
  error: 'error',
  paused: 'muted',
}

function RunLogCard({ log }: { log: AgentRunLog }) {
  const [expanded, setExpanded] = useState(log.status === 'running')
  const isRunning = log.status === 'running'

  return (
    <div className={`bg-surface-container-low rounded-[1.5rem] overflow-hidden transition-all ${
      isRunning ? 'border border-primary-container/20 shadow-neon' : 'border border-outline-variant/10'
    }`}>
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-container-high/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <StatusBeacon
            variant={log.status === 'completed' ? 'success' : log.status === 'failed' ? 'error' : 'pending'}
            pulse={isRunning}
          />
          <div>
            <p className="text-sm font-headline font-semibold text-on-surface flex items-center gap-2">
              Run {log.runId.slice(-8)}
              {isRunning && (
                <span className="text-[9px] font-label uppercase tracking-widest text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">
                  live
                </span>
              )}
            </p>
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mt-0.5">
              {format(new Date(log.startedAt), 'MMM d, yyyy · HH:mm')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-outline">Submitted</p>
            <p className="text-sm font-headline font-bold text-primary-container">
              {log.applicationsSubmitted}
            </p>
          </div>
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-outline">Processed</p>
            <p className="text-sm font-headline font-bold text-on-surface">
              {log.applicationsProcessed}
            </p>
          </div>
          {log.errors > 0 && (
            <div>
              <p className="text-xs font-label uppercase tracking-widest text-outline">Errors</p>
              <p className="text-sm font-headline font-bold text-destructive">{log.errors}</p>
            </div>
          )}
          <span className="text-outline text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && log.entries.length > 0 && (
        <div className="border-t border-outline-variant/10 p-5 space-y-2 max-h-80 overflow-y-auto">
          {log.entries.map((entry, i) => (
            <div key={i} className="flex gap-3 text-xs font-mono">
              <span className="text-outline shrink-0 w-16">
                {format(new Date(entry.timestamp), 'HH:mm:ss')}
              </span>
              <span className={`uppercase font-bold shrink-0 w-10 ${LOG_LEVEL_CLASSES[entry.level]}`}>
                {entry.level}
              </span>
              <span className="text-on-surface-variant">
                <span className="text-on-surface">{entry.action}</span>
                {entry.message && ` — ${entry.message}`}
              </span>
            </div>
          ))}
          {isRunning && (
            <div className="flex gap-3 text-xs font-mono items-center">
              <span className="text-outline shrink-0 w-16">now</span>
              <Loader2 className="w-3 h-3 text-primary-container animate-spin shrink-0" />
              <span className="text-primary-container/70">processing...</span>
            </div>
          )}
        </div>
      )}

      {expanded && log.entries.length === 0 && (
        <p className="border-t border-outline-variant/10 p-5 text-xs text-outline font-label uppercase tracking-widest text-center">
          No log entries
        </p>
      )}
    </div>
  )
}

export function AgentPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [logs, setLogs] = useState<AgentRunLog[]>([])
  const [triggering, setTriggering] = useState(false)
  const [loading, setLoading] = useState(true)
  const prevStatusRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const [s, l] = await Promise.all([getAgentStatusAction(), getAgentLogsAction()])

    // When transitioning from running → idle, do one extra refresh after a short delay
    // to catch the finalized run log
    if (prevStatusRef.current === 'running' && s.status !== 'running') {
      setTimeout(async () => {
        const [s2, l2] = await Promise.all([getAgentStatusAction(), getAgentLogsAction()])
        setStatus(s2)
        setLogs(l2)
      }, 1500)
    }

    prevStatusRef.current = s.status
    setStatus(s)
    setLogs(l)
    setLoading(false)
  }, [])

  // Adaptive polling: 3s when running, 15s when idle — also fires on mount
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, status?.status === 'running' ? 3000 : 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status])

  async function handleTrigger() {
    console.log('[AgentPanel] handleTrigger called')
    setTriggering(true)
    try {
      console.log('[AgentPanel] calling triggerAgentRunAction...')
      const result = await triggerAgentRunAction()
      console.log('[AgentPanel] result:', result)
      if (!result.ok) {
        console.error('[AgentPanel] trigger failed:', result.error)
        alert(`Failed to start agent: ${result.error}`)
      } else {
        // Start polling fast immediately after trigger
        await new Promise((r) => setTimeout(r, 800))
        await refresh()
      }
    } catch (err) {
      console.error('[AgentPanel] trigger error:', err)
      alert(`Error: ${String(err)}`)
    }
    setTriggering(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center">
        <StatusBeacon variant="info" pulse />
        <span className="text-sm text-on-surface-variant font-label">Loading agent status...</span>
      </div>
    )
  }

  const agentStatus = status?.status ?? 'idle'
  const isRunning = agentStatus === 'running'

  return (
    <div className="space-y-8">
      {/* Status panel */}
      <div className="glass-panel rounded-[2rem] p-8 flex items-center justify-between shadow-neon">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isRunning
                ? 'bg-primary-container/10 shadow-[0_0_30px_rgba(0,255,136,0.2)]'
                : 'bg-surface-container-high'
            }`}>
              <StatusBeacon
                variant={STATUS_BEACON[agentStatus] ?? 'muted'}
                pulse={isRunning || agentStatus === 'blocked'}
                size="md"
              />
            </div>
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-surface">
              {STATUS_LABEL[agentStatus] ?? agentStatus}
            </h2>
            {isRunning && status?.currentJob ? (
              <p className="text-sm text-primary-container/80 mt-1 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                {status.currentJob}
              </p>
            ) : status?.lastRunAt ? (
              <p className="text-sm text-on-surface-variant mt-1">
                Last run {formatDistanceToNow(new Date(status.lastRunAt), { addSuffix: true })}
              </p>
            ) : null}
            {status?.nextRunAt && (
              <p className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">
                Next run: {format(new Date(status.nextRunAt), 'HH:mm')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="p-3 rounded-[1rem] border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleTrigger}
            disabled={isRunning || triggering}
            className="flex items-center gap-2 px-5 py-3 rounded-[1rem] gradient-primary text-on-primary text-sm font-bold shadow-[0px_0px_20px_rgba(0,255,136,0.2)] hover:shadow-[0px_0px_25px_rgba(0,255,136,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {triggering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {triggering ? 'Triggering...' : isRunning ? 'Running...' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total runs"
            value={logs.length}
            tooltip="Number of times the pipeline was triggered (manually or by the scheduler)."
          />
          <StatCard
            label="Jobs scraped"
            value={logs.reduce((s, l) => s + l.applicationsProcessed, 0)}
            tooltip="Total job listings collected across all platforms in all runs."
          />
          <StatCard
            label="Matched jobs"
            value={logs.reduce((s, l) => s + l.applicationsSubmitted, 0)}
            tooltip="Jobs that passed semantic matching (score ≥ threshold) and were queued for CV generation and form filling."
          />
          <StatCard
            label="Errors"
            value={logs.reduce((s, l) => s + l.errors, 0)}
            tooltip="Total scraping or processing errors across all runs. Check run logs for details."
          />
        </div>
      )}

      {/* Run logs */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-label uppercase tracking-widest text-outline">
          Recent runs
        </h3>

        {logs.length === 0 ? (
          <div className="bg-surface-container-low rounded-[1.5rem] p-12 text-center border border-outline-variant/10">
            <p className="text-[10px] font-label uppercase tracking-widest text-outline">
              No runs recorded yet
            </p>
            <p className="text-sm text-on-surface-variant mt-2">
              Trigger a manual run or wait for the scheduled cycle.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <RunLogCard key={log.runId} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
