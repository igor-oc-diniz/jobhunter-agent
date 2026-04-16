'use client'

import { X, Share2, Bookmark, ExternalLink, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RawJobStatusBadge } from '@/components/design-system/atoms/RawJobStatusBadge'
import { ScoreBadge } from '@/components/design-system/atoms/ScoreBadge'
import type { RawJob } from '@/types'

interface JobDrawerProps {
  job: RawJob | null
  onClose: () => void
}

export function JobDrawer({ job, onClose }: JobDrawerProps) {
  if (!job) return null

  const hasScore = typeof job.matchScore === 'number'
  const details = job.matchDetails

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[480px] z-[60] flex flex-col bg-surface-container/60 backdrop-blur-[20px] border-l border-emerald-900/20 shadow-[-20px_0px_60px_rgba(0,0,0,0.5)]">
        {/* Drawer header */}
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-label font-bold uppercase tracking-widest text-outline">
              Job Intelligence Dossier
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-[1rem]">
              <Share2 className="w-4 h-4" />
            </button>
            <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-[1rem]">
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Title block */}
          <header>
            <div className="flex items-center gap-3 mb-4">
              {hasScore && (
                <ScoreBadge score={job.matchScore!} size="sm" className="bg-primary-container/10 px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter" />
              )}
              <RawJobStatusBadge status={job.status} />
              <span className="text-outline text-[10px] uppercase tracking-widest font-mono">
                {job.sourcePlatform}
              </span>
            </div>
            <h2 className="text-3xl font-headline font-bold text-primary leading-tight mb-1">
              {job.title}
            </h2>
            <p className="text-primary-container font-semibold text-lg">{job.company}</p>
            {job.location && (
              <p className="text-on-surface-variant text-sm mt-1">
                {job.location}
                {job.isRemote && (
                  <span className="ml-2 bg-secondary-container/10 text-secondary-container text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Remote
                  </span>
                )}
              </p>
            )}
          </header>

          {/* Job description */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-primary-container inline-block" />
              Job Description
            </h4>
            <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
            {job.requirements && (
              <p className="text-on-surface-variant text-sm leading-relaxed mt-4 whitespace-pre-line">
                {job.requirements}
              </p>
            )}
          </section>

          {/* Match intelligence */}
          {details && (
            <section className="bg-surface-container-lowest rounded-2xl p-6 border border-primary-container/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary-container mb-6 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Match Intelligence
              </h4>
              <div className="space-y-6">
                {details.positives?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-primary-container uppercase tracking-widest mb-3">
                      Positive Alignment
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {details.positives.map((item, i) => (
                        <span
                          key={i}
                          className="bg-primary-container/10 text-primary-container px-2 py-1 rounded text-[10px] border border-primary-container/20"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {details.gaps?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-tertiary-fixed-dim uppercase tracking-widest mb-3">
                      Skill Gaps
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {details.gaps.map((item, i) => (
                        <span
                          key={i}
                          className="bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim px-2 py-1 rounded text-[10px] border border-tertiary-fixed-dim/20"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {details.redFlags?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-error uppercase tracking-widest mb-3">
                      Red Flags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {details.redFlags.map((item, i) => (
                        <span
                          key={i}
                          className="bg-error/10 text-error px-2 py-1 rounded text-[10px] border border-error/20"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {details.justification && (
                  <div className="pt-4 border-t border-outline-variant/10">
                    <p className="text-xs text-on-surface-variant italic leading-relaxed">
                      &ldquo;{details.justification}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Salary & contract details */}
          {(job.salaryMin || job.salaryMax || job.contractType) && (
            <section className="flex gap-6">
              {job.contractType && job.contractType !== 'unknown' && (
                <div>
                  <span className="text-[10px] text-outline uppercase tracking-widest">Contract</span>
                  <p className="text-sm font-bold text-on-surface mt-1">{job.contractType.toUpperCase()}</p>
                </div>
              )}
              {(job.salaryMin || job.salaryMax) && (
                <div>
                  <span className="text-[10px] text-outline uppercase tracking-widest">Salary</span>
                  <p className="text-sm font-bold text-on-surface mt-1">
                    {job.salaryCurrency ?? '$'}
                    {job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : ''}
                    {job.salaryMin && job.salaryMax ? ' – ' : ''}
                    {job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : ''}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* CTA */}
        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest/80 shrink-0">
          <a
            href={`/jobs/${job.id}`}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all',
              'bg-primary-container text-on-primary-container',
              'hover:scale-[1.02] active:scale-95',
              'shadow-[0px_0px_20px_rgba(0,255,136,0.1)]'
            )}
          >
            Get Help Applying
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </aside>
    </>
  )
}
