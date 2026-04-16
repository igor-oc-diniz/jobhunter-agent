'use client'

import { cn } from '@/lib/utils'
import { Chip } from '../atoms/Chip'
import { RawJobStatusBadge } from '../atoms/RawJobStatusBadge'
import { ScoreBadge } from '../atoms/ScoreBadge'
import type { RawJob } from '@/types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-primary-container'
  if (score >= 50) return 'bg-tertiary-fixed-dim'
  return 'bg-error'
}

interface JobCardProps {
  job: RawJob
  selected?: boolean
  onClick?: () => void
}

export function JobCard({ job, selected, onClick }: JobCardProps) {
  const hasScore = typeof job.matchScore === 'number'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative bg-surface-container-low rounded-2xl p-6 cursor-pointer transition-all duration-200 border',
        'hover:bg-surface-container hover:scale-[1.01]',
        selected
          ? 'border-primary-container/20 shadow-[0px_10px_30px_rgba(0,255,136,0.03)]'
          : 'border-outline-variant/10'
      )}
    >
      {selected && (
        <div className="absolute left-0 top-0 h-full w-1 bg-primary-container rounded-l-2xl" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3
            className={cn(
              'text-base font-bold transition-colors',
              selected
                ? 'text-primary-container'
                : 'text-primary group-hover:text-primary-container'
            )}
          >
            {job.title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant mt-1 flex-wrap">
            <span>{job.company}</span>
            {job.location && (
              <>
                <span className="w-1 h-1 bg-outline rounded-full" />
                <span>{job.location}</span>
              </>
            )}
            {job.isRemote && (
              <span className="bg-secondary-container/10 text-secondary-container text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Remote
              </span>
            )}
          </div>
        </div>

        {hasScore && (
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            <ScoreBadge score={job.matchScore!} size="sm" />
            <div className="w-20 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', scoreBarColor(job.matchScore!))}
                style={{ width: `${job.matchScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tech stack chips */}
      {job.techStack?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {job.techStack.slice(0, 5).map((tech) => (
            <Chip key={tech} label={tech} />
          ))}
          {job.techStack.length > 5 && (
            <Chip label={`+${job.techStack.length - 5}`} className="text-outline" />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-5">
          {job.contractType && job.contractType !== 'unknown' && (
            <div className="flex flex-col">
              <span className="text-[10px] text-outline uppercase tracking-widest mb-0.5">Contract</span>
              <span className="text-xs font-bold text-on-surface capitalize">{job.contractType.toUpperCase()}</span>
            </div>
          )}
          {(job.salaryMin || job.salaryMax) && (
            <div className="flex flex-col">
              <span className="text-[10px] text-outline uppercase tracking-widest mb-0.5">Salary</span>
              <span className="text-xs font-bold text-on-surface">
                {job.salaryCurrency ?? '$'}
                {job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : ''}
                {job.salaryMin && job.salaryMax ? ' – ' : ''}
                {job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : ''}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] text-outline uppercase tracking-widest mb-0.5">Platform</span>
            <span className="text-xs font-bold text-on-surface">{job.sourcePlatform}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {job.scrapedAt && (
            <span className="font-mono text-[10px] text-outline uppercase tracking-widest">
              {timeAgo(job.scrapedAt as unknown as string)}
            </span>
          )}
          <RawJobStatusBadge status={job.status} />
        </div>
      </div>
    </div>
  )
}
