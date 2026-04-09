'use client'

import { useState } from 'react'
import { ExternalLink, Download, FileText, ChevronDown } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScoreBadge } from './ScoreBadge'
import { updateApplicationStatus } from '@/lib/firestore/applications'
import type { Application, ApplicationStatus } from '@/types'
import { format } from 'date-fns'

interface ApplicationDetailProps {
  application: Application | null
  userId: string
  onClose: () => void
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  awaiting_confirmation: 'Awaiting Confirmation',
  applied: 'Applied',
  viewed: 'Viewed',
  screening: 'Screening',
  interview_hr: 'HR Interview',
  interview_tech: 'Tech Interview',
  offer: 'Offer Received',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  failed: 'Failed',
}

export function ApplicationDetail({ application, userId, onClose }: ApplicationDetailProps) {
  const [notes, setNotes] = useState(application?.notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!application) return null

  const appliedAt = application.appliedAt
    ? format((application.appliedAt as any).toDate?.() ?? new Date(), 'MMM d, yyyy')
    : '—'

  async function handleWithdraw() {
    if (!application) return
    setSaving(true)
    await updateApplicationStatus(userId, application.jobId, 'withdrawn')
    setSaving(false)
    onClose()
  }

  return (
    <Sheet open={!!application} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg leading-tight">
            {application.jobSnapshot.title}
          </SheetTitle>
          <p className="text-muted-foreground text-sm">{application.jobSnapshot.company}</p>
        </SheetHeader>

        {/* Score + Status */}
        <div className="flex items-center gap-3 mb-4">
          <ScoreBadge score={application.matchScore} />
          <Badge variant="outline">{STATUS_LABELS[application.status]}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">{appliedAt}</span>
        </div>

        {/* Job details */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p>{application.jobSnapshot.isRemote ? 'Remote' : application.jobSnapshot.location}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contract</p>
            <p>{application.jobSnapshot.contractType ?? '—'}</p>
          </div>
          {application.jobSnapshot.salaryMax && (
            <div>
              <p className="text-xs text-muted-foreground">Salary</p>
              <p>
                R$ {application.jobSnapshot.salaryMin?.toLocaleString()} –{' '}
                {application.jobSnapshot.salaryMax?.toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Platform</p>
            <p className="capitalize">{application.jobSnapshot.sourcePlatform}</p>
          </div>
        </div>

        {/* Tech stack */}
        {application.jobSnapshot.techStack.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Tech stack</p>
            <div className="flex flex-wrap gap-1">
              {application.jobSnapshot.techStack.map((t) => (
                <span key={t} className="bg-muted text-xs px-2 py-0.5 rounded">{t}</span>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Documents */}
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium">Documents</p>
          {application.cvUrl && (
            <a
              href={application.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="w-4 h-4" /> Download CV
            </a>
          )}
          {application.coverLetterText && (
            <details className="text-sm">
              <summary className="flex items-center gap-2 cursor-pointer text-primary hover:underline list-none">
                <FileText className="w-4 h-4" /> Cover letter
                <ChevronDown className="w-3 h-3" />
              </summary>
              <p className="mt-2 text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed">
                {application.coverLetterText}
              </p>
            </details>
          )}
          <a
            href={application.jobSnapshot.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> View original job posting
          </a>
        </div>

        <Separator className="my-4" />

        {/* Stage timeline */}
        {application.stages.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Timeline</p>
            <div className="space-y-2">
              {application.stages.map((stage, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground text-xs w-24 shrink-0">
                    {format(new Date(stage.date), 'MMM d, yyyy')}
                  </span>
                  <div>
                    <p>{stage.name}</p>
                    {stage.notes && <p className="text-xs text-muted-foreground">{stage.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Notes */}
        <div className="mb-4">
          <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
          <Textarea
            id="notes"
            className="mt-1"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this application..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleWithdraw}
            disabled={saving || ['hired', 'rejected', 'withdrawn'].includes(application.status)}
          >
            Withdraw
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
