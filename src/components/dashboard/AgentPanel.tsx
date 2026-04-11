'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Play, RefreshCw } from 'lucide-react'
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
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-container-low rounded-[1.5rem] border border-outline-variant/10 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-container-high/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <StatusBeacon
            variant={log.status === 'completed' ? 'success' : log.status === 'failed' ? 'error' : 'pending'}
            pulse={log.status === 'running'}
          />
          <div>
            <p className="text-sm font-headline font-semibold text-on-surface">
              Run {log.runId.slice(-8)}
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

  const refresh = useCallback(async () => {
    const [s, l] = await Promise.all([getAgentStatusAction(), getAgentLogsAction()])
    setStatus(s)
    setLogs(l)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15_000)
    return () => clearInterval(interval)
  }, [refresh])

  async function handleTrigger() {
    setTriggering(true)
    await triggerAgentRunAction()
    await refresh()
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
            {status?.lastRunAt && (
              <p className="text-sm text-on-surface-variant mt-1">
                Last run {formatDistanceToNow(new Date(status.lastRunAt), { addSuffix: true })}
              </p>
            )}
            {status?.nextRunAt && (
              <p className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">
                Next run: {format(new Date(status.nextRunAt), 'HH:mm')}
              </p>
            )}
            {status?.currentJob && (
              <p className="text-xs text-secondary mt-1">Processing: {status.currentJob}</p>
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
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {triggering ? 'Triggering...' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total runs"
            value={logs.length}
          />
          <StatCard
            label="Applications submitted"
            value={logs.reduce((s, l) => s + l.applicationsSubmitted, 0)}
          />
          <StatCard
            label="Jobs processed"
            value={logs.reduce((s, l) => s + l.applicationsProcessed, 0)}
          />
          <StatCard
            label="Errors"
            value={logs.reduce((s, l) => s + l.errors, 0)}
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
