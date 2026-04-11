export type AgentRunStatus = 'idle' | 'running' | 'blocked' | 'error' | 'paused'

export interface AgentStatus {
  status: AgentRunStatus
  lastRunAt?: string
  nextRunAt?: string
  currentJob?: string
  updatedAt: string
}

export type AgentLogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface AgentLogEntry {
  level: AgentLogLevel
  action: string
  message: string
  timestamp: string
  jobId?: string
  platform?: string
  meta?: Record<string, unknown>
}

export interface AgentRunLog {
  runId: string
  userId: string
  startedAt: string
  finishedAt?: string
  status: 'running' | 'completed' | 'failed'
  applicationsProcessed: number
  applicationsSubmitted: number
  errors: number
  entries: AgentLogEntry[]
}
