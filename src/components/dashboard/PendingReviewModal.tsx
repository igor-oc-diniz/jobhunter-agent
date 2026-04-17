'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, CheckCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { archiveRawJobAction, approveRawJobAction } from '@/app/actions/jobs'
import type { RawJob } from '@/types'

interface PendingReviewModalProps {
  jobs: RawJob[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onJobActioned: (jobId: string) => void
}

function JobReviewSlide({ job }: { job: RawJob }) {
  return (
    <div className="w-full shrink-0 h-full overflow-y-auto px-6 py-5 space-y-6">
      {/* Title block */}
      <header>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-outline text-[10px] uppercase tracking-widest font-mono bg-surface-container-high px-2 py-0.5 rounded">
            {job.sourcePlatform}
          </span>
          {job.isRemote && (
            <span className="bg-secondary-container/10 text-secondary-container text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Remote
            </span>
          )}
          {job.contractType && job.contractType !== 'unknown' && (
            <span className="bg-surface-container-high text-on-surface-variant text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              {job.contractType.toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-headline font-bold text-primary leading-tight mb-1">
          {job.title}
        </h2>
        <p className="text-primary-container font-semibold text-base">{job.company}</p>
        {job.location && (
          <p className="text-on-surface-variant text-sm mt-1">{job.location}</p>
        )}
      </header>

      {/* Salary */}
      {(job.salaryMin || job.salaryMax) && (
        <div className="flex gap-1 items-baseline">
          <span className="text-[10px] text-outline uppercase tracking-widest">Salary:</span>
          <span className="text-sm font-bold text-on-surface">
            {job.salaryCurrency ?? '$'}
            {job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : ''}
            {job.salaryMin && job.salaryMax ? ' – ' : ''}
            {job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : ''}
          </span>
        </div>
      )}

      {/* Tech stack */}
      {job.techStack?.length > 0 && (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
            Tech Stack
          </p>
          <div className="flex flex-wrap gap-1.5">
            {job.techStack.map((tech) => (
              <span
                key={tech}
                className="bg-primary-container/10 text-primary-container px-2 py-0.5 rounded text-[10px] border border-primary-container/20 font-mono"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline mb-3 flex items-center gap-2">
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

      {/* Source URL */}
      {job.sourceUrl && (
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-outline hover:text-on-surface-variant transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View original posting
        </a>
      )}
    </div>
  )
}

function DoneSlide({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-full shrink-0 h-full flex flex-col items-center justify-center gap-4 px-6">
      <CheckCircle2 className="w-14 h-14 text-primary-container" />
      <h3 className="text-xl font-headline font-bold text-on-surface">All jobs reviewed</h3>
      <p className="text-sm text-on-surface-variant text-center">
        The pipeline will process your approved jobs shortly.
      </p>
      <Button variant="outline" onClick={onClose} className="mt-2">
        Close
      </Button>
    </div>
  )
}

export function PendingReviewModal({
  jobs,
  open,
  onOpenChange,
  onJobActioned,
}: PendingReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loadingAction, setLoadingAction] = useState<'archive' | 'approve' | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setIsDone(jobs.length === 0)
      setError(null)
      setLoadingAction(null)
    }
  }, [open, jobs.length])

  useEffect(() => {
    const job = jobs[currentIndex]
    if (open && job) {
      console.log('[PendingReview] job id:', job.id)
    }
  }, [open, currentIndex, jobs])

  async function handleAction(type: 'archive' | 'approve') {
    const job = jobs[currentIndex]
    if (!job || loadingAction !== null) return

    setError(null)
    setLoadingAction(type)
    try {
      if (type === 'archive') {
        await archiveRawJobAction(job.id)
      } else {
        await approveRawJobAction(job.id)
      }
      onJobActioned(job.id)
      const nextIndex = currentIndex + 1
      if (nextIndex >= jobs.length) {
        setIsDone(true)
        setCurrentIndex(nextIndex)
      } else {
        setCurrentIndex(nextIndex)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingAction(null)
    }
  }

  const currentJob = jobs[currentIndex]
  const translateX = isDone ? jobs.length * 100 : currentIndex * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-2xl w-full p-0 overflow-hidden gap-0"
        style={{ maxWidth: '42rem' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-outline-variant/10">
          <DialogTitle className="text-on-surface">Pending Review</DialogTitle>
          <DialogDescription>
            {isDone
              ? 'All jobs reviewed'
              : `${currentIndex + 1} of ${jobs.length} — review each job and decide`}
          </DialogDescription>
        </DialogHeader>

        {/* Carousel viewport */}
        <div className="overflow-hidden" style={{ height: '520px' }}>
          <div
            ref={carouselRef}
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${translateX}%)` }}
          >
            {jobs.map((job) => (
              <JobReviewSlide key={job.id} job={job} />
            ))}
            <DoneSlide onClose={() => onOpenChange(false)} />
          </div>
        </div>

        {/* Footer */}
        {!isDone && currentJob && (
          <DialogFooter className="px-6 py-4 border-t border-outline-variant/10 sm:flex-row gap-3 bg-surface-container-lowest/60">
            {error && (
              <p className="text-xs text-error flex-1 self-center">{error}</p>
            )}
            <Button
              variant="destructive"
              disabled={loadingAction !== null}
              onClick={() => handleAction('archive')}
              className="gap-2"
            >
              {loadingAction === 'archive' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              Archive
            </Button>
            <Button
              disabled={loadingAction !== null}
              onClick={() => handleAction('approve')}
              className="gap-2 bg-primary-container text-on-primary-container hover:bg-primary-container/90"
            >
              {loadingAction === 'approve' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Queue for Application
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
