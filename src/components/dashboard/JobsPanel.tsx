'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Briefcase } from 'lucide-react'
import { StatCard } from '@/components/design-system/molecules/StatCard'
import { JobCard } from '@/components/design-system/molecules/JobCard'
import { JobDrawer } from './JobDrawer'
import { PendingReviewModal } from './PendingReviewModal'
import type { RawJob } from '@/types'

interface JobsPanelProps {
  jobs: RawJob[]
}

type StatusFilter = RawJob['status'] | 'all'
type SortOption = 'recent' | 'score'

export function JobsPanel({ jobs }: JobsPanelProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [sort, setSort] = useState<SortOption>('recent')
  const [selectedJob, setSelectedJob] = useState<RawJob | null>(null)
  const [pendingReviewOpen, setPendingReviewOpen] = useState(false)
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(new Set())

  const platforms = useMemo(() => {
    const set = new Set(jobs.map((j) => j.sourcePlatform))
    return Array.from(set).sort()
  }, [jobs])

  const filtered = useMemo(() => {
    let result = jobs

    if (statusFilter !== 'all') {
      result = result.filter((j) => j.status === statusFilter)
    }
    if (platformFilter !== 'all') {
      result = result.filter((j) => j.sourcePlatform === platformFilter)
    }
    if (remoteOnly) {
      result = result.filter((j) => j.isRemote)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q)
      )
    }
    if (sort === 'score') {
      result = [...result].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    }
    return result
  }, [jobs, statusFilter, platformFilter, remoteOnly, search, sort])

  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === 'pending' && !reviewedJobIds.has(j.id)),
    [jobs, reviewedJobIds]
  )

  const counts = useMemo(() => ({
    total: jobs.length,
    matched: jobs.filter((j) => j.status === 'matched').length,
    pending: pendingJobs.length,
    rejected: jobs.filter((j) => j.status === 'rejected').length,
  }), [jobs, pendingJobs])

  function handleJobActioned(jobId: string) {
    setReviewedJobIds((prev) => new Set(prev).add(jobId))
  }

  function handlePendingReviewOpenChange(open: boolean) {
    setPendingReviewOpen(open)
    if (!open) router.refresh()
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Found" value={counts.total} />
        <StatCard
          label="High Match"
          value={counts.matched}
          className="border-primary-container/20"
        />
        <StatCard
          label="Pending Review"
          value={counts.pending}
          className="border-tertiary-fixed/20"
          onClick={pendingJobs.length > 0 ? () => setPendingReviewOpen(true) : undefined}
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          className="border-error/20"
        />
      </div>

      {/* Filter bar */}
      <div className="bg-surface-container-low rounded-2xl p-4 mb-8 flex flex-wrap items-center gap-4 border border-outline-variant/5">
        {/* Search */}
        <div className="flex-1 min-w-[240px] bg-surface-container-lowest px-4 py-2.5 rounded-xl flex items-center gap-3 border border-outline-variant/15">
          <Search className="w-4 h-4 text-outline shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title or company..."
            className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder-outline w-full outline-none"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-surface-container-highest text-on-surface border-none rounded-[1rem] text-sm px-4 py-2.5 focus:ring-1 focus:ring-primary-container outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="matched">Matched</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="applied">Applied</option>
            <option value="error">Error</option>
          </select>

          {/* Platform */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-surface-container-highest text-on-surface border-none rounded-[1rem] text-sm px-4 py-2.5 focus:ring-1 focus:ring-primary-container outline-none cursor-pointer"
          >
            <option value="all">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Remote toggle */}
          <button
            onClick={() => setRemoteOnly((v) => !v)}
            className="flex items-center gap-3 px-4 py-2 bg-surface-container-highest rounded-[1rem] transition-colors"
          >
            <span className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Remote</span>
            <div
              className={`w-10 h-5 rounded-full relative transition-colors ${
                remoteOnly ? 'bg-primary-container' : 'bg-surface-container'
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 bg-on-primary-container rounded-full transition-all ${
                  remoteOnly ? 'right-1' : 'left-1 bg-outline'
                }`}
              />
            </div>
          </button>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-surface-container-highest text-on-surface border-none rounded-[1rem] text-sm px-4 py-2.5 focus:ring-1 focus:ring-primary-container outline-none cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="score">Highest Match</option>
          </select>
        </div>
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-outline gap-4">
          <Briefcase className="w-12 h-12 opacity-30" />
          <p className="text-sm font-label uppercase tracking-widest">No jobs found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={selectedJob?.id === job.id}
              onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
            />
          ))}
        </div>
      )}

      {/* Side drawer */}
      <JobDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />

      {/* Pending review modal */}
      <PendingReviewModal
        jobs={pendingJobs}
        open={pendingReviewOpen}
        onOpenChange={handlePendingReviewOpenChange}
        onJobActioned={handleJobActioned}
      />
    </>
  )
}
