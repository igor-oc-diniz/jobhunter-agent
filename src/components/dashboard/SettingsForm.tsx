'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { saveAgentConfigAction } from '@/app/actions/settings'
import type { AgentConfig } from '@/types'

const ALL_PLATFORMS = ['linkedin', 'gupy', 'indeed', 'infojobs', 'catho']

interface SettingsFormProps {
  initialConfig: AgentConfig
}

export function SettingsForm({ initialConfig }: SettingsFormProps) {
  const [config, setConfig] = useState<AgentConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newExclude, setNewExclude] = useState('')

  function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function togglePlatform(platform: string) {
    const enabled = config.enabledPlatforms.includes(platform)
    update(
      'enabledPlatforms',
      enabled
        ? config.enabledPlatforms.filter((p) => p !== platform)
        : [...config.enabledPlatforms, platform]
    )
  }

  function addKeyword() {
    const kw = newKeyword.trim()
    if (!kw || config.searchKeywords.includes(kw)) return
    update('searchKeywords', [...config.searchKeywords, kw])
    setNewKeyword('')
  }

  function removeKeyword(kw: string) {
    update('searchKeywords', config.searchKeywords.filter((k) => k !== kw))
  }

  function addExclude() {
    const kw = newExclude.trim()
    if (!kw || config.excludeKeywords.includes(kw)) return
    update('excludeKeywords', [...config.excludeKeywords, kw])
    setNewExclude('')
  }

  function removeExclude(kw: string) {
    update('excludeKeywords', config.excludeKeywords.filter((k) => k !== kw))
  }

  async function handleSave() {
    setSaving(true)
    await saveAgentConfigAction(config)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Thresholds */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-label uppercase tracking-widest text-outline">
          Minimum Match Score
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={40}
            max={95}
            step={5}
            value={config.minScore}
            onChange={(e) => update('minScore', Number(e.target.value))}
            className="flex-1 accent-[#00ff88]"
          />
          <span className="text-sm font-headline font-bold text-primary-container w-12 text-right">
            {config.minScore}%
          </span>
        </div>
      </section>

      {/* Platforms */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-label uppercase tracking-widest text-outline">
          Enabled Platforms
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((platform) => {
            const enabled = config.enabledPlatforms.includes(platform)
            return (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`px-4 py-2 rounded-[1rem] border text-sm font-bold font-label uppercase tracking-wider transition-all ${
                  enabled
                    ? 'bg-primary-container/10 border-primary-container/30 text-primary-container'
                    : 'border-outline-variant/20 text-outline hover:border-outline-variant/40 hover:text-on-surface-variant'
                }`}
              >
                {enabled && <span className="mr-1.5">✓</span>}
                {platform}
              </button>
            )
          })}
        </div>
      </section>

      {/* Keywords */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-label uppercase tracking-widest text-outline">
          Search Keywords
        </h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {config.searchKeywords.map((kw) => (
            <span
              key={kw}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full text-xs text-on-surface-variant"
            >
              {kw}
              <button onClick={() => removeKeyword(kw)} className="text-outline hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Add keyword..."
            className="flex-1 h-10 px-4 bg-surface-container-lowest rounded-[1rem] border-none text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-b-2 focus:border-primary-container"
          />
          <button
            onClick={addKeyword}
            className="w-10 h-10 rounded-[1rem] bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-primary-container hover:border-primary-container/30 transition-all flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Exclude keywords */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-label uppercase tracking-widest text-outline">
          Exclude Keywords
        </h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {config.excludeKeywords.map((kw) => (
            <span
              key={kw}
              className="flex items-center gap-1.5 px-3 py-1 bg-error-container/20 border border-destructive/20 rounded-full text-xs text-destructive"
            >
              {kw}
              <button onClick={() => removeExclude(kw)} className="hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExclude()}
            placeholder="Add exclusion..."
            className="flex-1 h-10 px-4 bg-surface-container-lowest rounded-[1rem] border-none text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-b-2 focus:border-primary-container"
          />
          <button
            onClick={addExclude}
            className="w-10 h-10 rounded-[1rem] bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-destructive hover:border-destructive/30 transition-all flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-[1rem] gradient-primary text-on-primary text-sm font-bold shadow-[0px_0px_20px_rgba(0,255,136,0.2)] hover:shadow-[0px_0px_25px_rgba(0,255,136,0.4)] transition-all active:scale-95 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-primary-container text-sm font-bold">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}
