'use client'

import { useState } from 'react'
import { FileText, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateCVAction } from '@/app/actions/generate-cv'
import type { CVGenerationState } from '@/types/cv-generation'
import { isGenerateCVSuccess, isGenerateCVError } from '@/types/cv-generation'

interface GenerateCVButtonProps {
  userId: string
  jobId: string
  className?: string
}

export function GenerateCVButton({ userId, jobId, className }: GenerateCVButtonProps) {
  const [state, setState] = useState<CVGenerationState>({
    isGenerating: false,
    result: null,
    error: null,
  })

  async function handleGenerate() {
    // Reset state and start generation
    setState({ isGenerating: true, result: null, error: null })

    try {
      const result = await generateCVAction(userId, jobId)

      if (isGenerateCVSuccess(result)) {
        setState({
          isGenerating: false,
          result,
          error: null,
        })
        // Automatically open PDF in new tab
        window.open(result.pdfUrl, '_blank', 'noopener,noreferrer')
      } else if (isGenerateCVError(result)) {
        setState({
          isGenerating: false,
          result: null,
          error: result.error,
        })
      }
    } catch (err) {
      setState({
        isGenerating: false,
        result: null,
        error: err instanceof Error ? err.message : 'Failed to generate CV',
      })
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <button
        onClick={handleGenerate}
        disabled={state.isGenerating}
        className={cn(
          'bg-surface-container-high hover:bg-surface-container-highest transition-all py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 border border-outline-variant/10',
          'hover:scale-[1.01] active:scale-95',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
        )}
      >
        {state.isGenerating ? (
          <Loader2 className="w-4 h-4 text-primary-container animate-spin" />
        ) : (
          <FileText className="w-4 h-4 text-primary-container" />
        )}
        <span className="text-xs font-headline font-bold text-primary uppercase tracking-widest">
          {state.isGenerating ? 'Generating...' : 'Generate Custom CV'}
        </span>
      </button>

      {/* Success message */}
      {state.result && (
        <div className="flex items-start gap-3 bg-primary-container/5 border border-primary-container/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <a
              href={state.result.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary-container hover:text-primary-fixed transition-colors inline-flex items-center gap-1.5 group"
            >
              CV Generated — View PDF
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <div className="text-xs text-on-surface-variant mt-1">
              Generated {new Date(state.result.generatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {state.error && (
        <div className="bg-error/5 border border-error/20 rounded-xl p-4">
          <p className="text-sm text-error leading-relaxed">{state.error}</p>
        </div>
      )}
    </div>
  )
}
