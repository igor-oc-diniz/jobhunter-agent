'use client'

import { useState } from 'react'
import { ExternalLink, Download, FileText, ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScoreBadge, StatusBadge, Chip } from '@/components/design-system'
import { updateApplicationStatus } from '@/lib/firestore/applications'
import type { Application, ApplicationStatus } from '@/types'
import { format } from 'date-fns'

interface ApplicationDetailProps {
  application: Application | null
  userId: string
  onClose: () => void
}

export function ApplicationDetail({ application, userId, onClose }: ApplicationDetailProps) {
  const [notes, setNotes] = useState(application?.notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!application) return null

  const appliedAt = application.appliedAt
    ? format(
        (application.appliedAt as { toDate?: () => Date }).toDate?.() ?? new Date(application.appliedAt as string),
        'MMM d, yyyy'
      )
    : '—'

  async function handleWithdraw() {
    if (!application) return
    setSaving(true)
    await updateApplicationStatus(userId, application.jobId, 'withdrawn' as ApplicationStatus)
    setSaving(false)
    onClose()
  }

  return (
    <Sheet open={!!application} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-surface-container-low border-l border-outline-variant/15">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-headline text-lg text-on-surface leading-tight">
            {application.jobSnapshot.title}
          </SheetTitle>
          <p className="text-on-surface-variant text-sm">{application.jobSnapshot.company}</p>
        </SheetHeader>

        {/* Score + Status */}
        <div className="flex items-center gap-3 mb-6">
          <ScoreBadge score={application.matchScore} size="md" />
          <div className="flex-1">
            <StatusBadge status={application.status} />
            <p className="text-[10px] text-outline mt-1 font-label uppercase tracking-widest">
              {appliedAt}
            </p>
          </div>
        </div>

        {/* Job details */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-6 glass-panel p-4 rounded-[1rem]">
          <div>
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Location</p>
            <p className="text-on-surface">{application.jobSnapshot.isRemote ? 'Remote' : application.jobSnapshot.location}</p>
          </div>
          <div>
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Contract</p>
            <p className="text-on-surface">{application.jobSnapshot.contractType ?? '—'}</p>
          </div>
          {application.jobSnapshot.salaryMax && (
            <div>
              <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Salary</p>
              <p className="text-on-surface">
                R$ {application.jobSnapshot.salaryMin?.toLocaleString()} –{' '}
                {application.jobSnapshot.salaryMax?.toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Platform</p>
            <p className="text-on-surface capitalize">{application.jobSnapshot.sourcePlatform}</p>
          </div>
        </div>

        {/* Tech stack */}
        {application.jobSnapshot.techStack.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-2">Tech stack</p>
            <div className="flex flex-wrap gap-1.5">
              {application.jobSnapshot.techStack.map((t) => (
                <Chip key={t} label={t} />
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-outline-variant/15 my-4" />

        {/* Documents */}
        <div className="space-y-3 mb-6">
          <p className="text-[10px] font-label uppercase tracking-widest text-outline">Documents</p>
          {application.cvUrl && (
            <a
              href={application.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-container hover:underline"
            >
              <Download className="w-4 h-4" /> Download CV
            </a>
          )}
          {application.coverLetterText && (
            <details className="text-sm">
              <summary className="flex items-center gap-2 cursor-pointer text-secondary hover:underline list-none">
                <FileText className="w-4 h-4" /> Cover letter
                <ChevronDown className="w-3 h-3" />
              </summary>
              <p className="mt-2 text-on-surface-variant whitespace-pre-wrap text-xs leading-relaxed bg-surface-container-lowest p-3 rounded-[1rem]">
                {application.coverLetterText}
              </p>
            </details>
          )}
          <a
            href={application.jobSnapshot.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-secondary hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> View original posting
          </a>
        </div>

        <div className="h-px bg-outline-variant/15 my-4" />

        {/* Stage timeline */}
        {application.stages.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-3">Timeline</p>
            <div className="space-y-3">
              {application.stages.map((stage, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-outline text-xs w-24 shrink-0 font-label">
                    {format(new Date(stage.date), 'MMM d, yyyy')}
                  </span>
                  <div>
                    <p className="text-on-surface">{stage.name}</p>
                    {stage.notes && <p className="text-xs text-on-surface-variant">{stage.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-outline-variant/15 my-4" />

        {/* Notes */}
        <div className="mb-6">
          <Label htmlFor="notes" className="text-[10px] font-label uppercase tracking-widest text-outline">
            Notes
          </Label>
          <Textarea
            id="notes"
            className="mt-2 bg-surface-container-lowest border-none rounded-[1rem] text-on-surface placeholder:text-outline focus-visible:border-b-2 focus-visible:border-primary-container focus-visible:ring-0"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this application..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleWithdraw}
            disabled={saving || ['hired', 'rejected', 'withdrawn'].includes(application.status)}
            className="h-10 px-5 rounded-[1rem] bg-error-container/20 border border-destructive/30 text-destructive text-sm font-bold hover:bg-error-container hover:text-on-error transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
