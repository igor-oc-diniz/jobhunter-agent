'use client'

import { useRef, useState } from 'react'
import { importFromCVAction } from '@/app/actions/profile-import'
import type { UserProfile } from '@/types'

type PartialProfile = Partial<Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>>

interface Props {
  onImported: (data: PartialProfile) => void
  onSkip: () => void
}

export function StepImport({ onImported, onSkip }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds 5MB limit.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await importFromCVAction(formData)
      onImported(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import resume.')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col items-center gap-10 w-full" data-testid="step-import">
      {/* Title */}
      <div className="text-center mt-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-primary mb-3">
          How would you like to start?
        </h1>
        <p className="text-lg text-on-surface-variant font-body max-w-xl mx-auto">
          Choose a method to build your hunter profile.
        </p>
      </div>

      {/* Upload Card */}
      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={() => !loading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={loading}
          className={`w-full group relative flex flex-col items-center justify-center text-center p-10 md:p-12 rounded-[2rem] bg-surface-container-low/40 backdrop-blur-xl border-2 transition-all duration-500 overflow-hidden
            ${dragging
              ? 'border-primary-container scale-[1.01] shadow-[0px_0px_60px_rgba(0,255,136,0.15)]'
              : 'border-primary-container/20 hover:scale-[1.01] hover:shadow-[0px_0px_40px_rgba(0,255,136,0.08)]'
            }
            ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
          `}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary-container/10 to-transparent pointer-events-none" />

          {/* Icon */}
          <div className={`w-24 h-24 rounded-full bg-primary-container flex items-center justify-center mb-6 transition-all duration-500 ${loading ? '' : 'group-hover:shadow-[0px_0px_50px_rgba(0,255,136,0.5)]'}`}>
            {loading ? (
              <svg className="w-10 h-10 text-on-primary-container animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-on-primary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
          </div>

          <h3 className="text-3xl font-headline font-bold text-primary mb-3">
            {loading ? 'Extracting profile…' : 'Upload Resume'}
          </h3>
          <p className="text-on-surface-variant text-base font-body leading-relaxed max-w-sm mb-5">
            {loading
              ? 'Claude is reading your resume and filling in your profile.'
              : 'Import your data from a PDF file.'}
          </p>

          {!loading && (
            <>
              <p className="text-primary-container text-xs font-label uppercase tracking-[0.2em] font-bold mb-8">
                Drag and drop your file here or click to browse
              </p>

              <div className="py-3 px-10 rounded-full bg-primary-container text-on-primary-container font-label text-xs uppercase tracking-[0.2em] font-bold shadow-lg shadow-primary-container/20 group-hover:bg-primary-fixed group-hover:scale-105 transition-all mb-8">
                Select File
              </div>

              {/* LinkedIn sync tip */}
              <div className="p-4 rounded-[1rem] bg-surface-container/60 border border-outline-variant/20 w-full max-w-md text-left">
                <div className="flex items-center gap-2 mb-2 text-secondary-container">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest">LinkedIn Sync Tip</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Want to use your LinkedIn? Go to your profile →{' '}
                  <span className="text-primary-container font-medium">More</span> →{' '}
                  <span className="text-primary-container font-medium">Save to PDF</span>, then upload the file here.
                </p>
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 text-sm text-error">{error}</p>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={loading}
        />
      </div>

      {/* OR divider + Manual Setup */}
      <div className="w-full flex flex-col items-center max-w-2xl">
        <div className="flex items-center gap-4 w-full mb-6">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">or</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>

        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="w-full group relative flex items-center justify-between p-6 rounded-[1.5rem] bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10 hover:border-primary-container/30 transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-primary-container/10 transition-colors">
              <svg className="w-6 h-6 text-primary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-headline font-semibold text-primary">Manual Setup</h3>
              <p className="text-on-surface-variant text-xs font-body">Fill in your details manually step-by-step.</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-on-surface-variant/40 group-hover:text-primary-container group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Footer features */}
      <div className="w-full max-w-2xl pt-8 border-t border-outline-variant/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 p-6 rounded-[1.5rem] bg-surface-container-low/20 border border-outline-variant/5">
            <div className="w-12 h-12 rounded-[1rem] bg-primary-container/10 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h4 className="text-primary font-headline font-semibold mb-2 uppercase tracking-wider text-sm">Data Integrity</h4>
              <p className="text-on-surface-variant text-sm font-body leading-relaxed">
                Your professional data is protected. We prioritize your privacy and ensure your information remains secure.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-6 rounded-[1.5rem] bg-surface-container-low/20 border border-outline-variant/5">
            <div className="w-12 h-12 rounded-[1rem] bg-secondary-container/10 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-secondary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-primary font-headline font-semibold mb-2 uppercase tracking-wider text-sm">AI Enhancement</h4>
              <p className="text-on-surface-variant text-sm font-body leading-relaxed">
                Claude automatically parses and optimizes your profile, highlighting key strengths to ensure you stand out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
