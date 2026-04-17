'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuestionAnalysis {
  index: number
  answer: string
}

export function FormAssistant() {
  const [text, setText] = useState('')
  const [analyses, setAnalyses] = useState<QuestionAnalysis[]>([])
  const [loading, setLoading] = useState(false)

  async function handleExtract() {
    if (!text.trim() || loading) return

    setLoading(true)
    // Simulate extraction — real implementation calls Claude API
    await new Promise((r) => setTimeout(r, 800))
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 5)
    setAnalyses(
      lines.map((line, i) => ({
        index: i + 1,
        answer: line,
      }))
    )
    setLoading(false)
  }

  return (
    <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
      <h3 className="text-lg font-headline font-bold text-primary uppercase tracking-widest mb-6 flex items-center gap-3">
        <Wand2 className="w-5 h-5 text-primary-container" />
        Form Assistant
      </h3>

      <div className="space-y-6">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl text-sm text-on-surface p-4 pr-28 focus:ring-1 focus:ring-primary-container outline-none min-h-[120px] resize-none placeholder:text-outline"
            placeholder="Paste application questions here..."
          />
          <button
            onClick={handleExtract}
            disabled={!text.trim() || loading}
            className={cn(
              'absolute bottom-4 right-4 bg-primary-container text-on-primary-container px-5 py-2 rounded-xl text-[10px] font-headline font-bold flex items-center gap-2 transition-all uppercase tracking-widest',
              'hover:bg-primary-fixed active:scale-95',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary-container'
            )}
          >
            <Wand2 className="w-3 h-3" />
            {loading ? 'Processing...' : 'Extract'}
          </button>
        </div>

        {analyses.length > 0 && (
          <div className="space-y-3">
            {analyses.map((item) => (
              <div
                key={item.index}
                className="p-4 bg-surface-container-high/40 rounded-xl border border-outline-variant/10 space-y-2"
              >
                <div className="text-[10px] text-primary-container font-mono uppercase tracking-widest">
                  Question Analysis {String(item.index).padStart(2, '0')}
                </div>
                <div className="text-sm text-on-surface leading-relaxed italic">
                  &ldquo;{item.answer}&rdquo;
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
