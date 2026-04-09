'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import type { UserProfile, TechnicalSkill, Language } from '@/types'

interface Props {
  defaultValues?: UserProfile['skills']
  onBack: () => void
  onNext: (values: UserProfile['skills']) => void
}

const SKILL_LEVELS = ['basic', 'intermediate', 'advanced', 'expert'] as const
const LANG_LEVELS = ['basic', 'intermediate', 'advanced', 'fluent', 'native'] as const

export function StepSkills({ defaultValues, onBack, onNext }: Props) {
  const [technical, setTechnical] = useState<TechnicalSkill[]>(defaultValues?.technical ?? [])
  const [tools, setTools] = useState<string[]>(defaultValues?.tools ?? [])
  const [languages, setLanguages] = useState<Language[]>(defaultValues?.languages ?? [])
  const [soft, setSoft] = useState<string[]>(defaultValues?.soft ?? [])

  const [techInput, setTechInput] = useState('')
  const [techLevel, setTechLevel] = useState<TechnicalSkill['level']>('intermediate')
  const [toolInput, setToolInput] = useState('')
  const [langInput, setLangInput] = useState('')
  const [langLevel, setLangLevel] = useState<Language['level']>('intermediate')
  const [softInput, setSoftInput] = useState('')

  function addTech() {
    const name = techInput.trim()
    if (!name || technical.some((t) => t.name.toLowerCase() === name.toLowerCase())) return
    setTechnical((prev) => [...prev, { name, level: techLevel }])
    setTechInput('')
  }

  function addTool() {
    const t = toolInput.trim()
    if (!t || tools.includes(t)) return
    setTools((prev) => [...prev, t])
    setToolInput('')
  }

  function addLanguage() {
    const l = langInput.trim()
    if (!l || languages.some((x) => x.language.toLowerCase() === l.toLowerCase())) return
    setLanguages((prev) => [...prev, { language: l, level: langLevel }])
    setLangInput('')
  }

  function addSoft() {
    const s = softInput.trim()
    if (!s || soft.includes(s)) return
    setSoft((prev) => [...prev, s])
    setSoftInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext({ technical, tools, languages, soft })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Technical skills */}
      <div className="space-y-2">
        <Label>Technical skills</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. React"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }}
          />
          <Select value={techLevel} onValueChange={(v) => setTechLevel(v as TechnicalSkill['level'])}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SKILL_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={addTech}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {technical.map((t) => (
            <Badge key={t.name} variant="secondary" className="gap-1">
              {t.name} · {t.level}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setTechnical((prev) => prev.filter((x) => x.name !== t.name))} />
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Tools */}
      <div className="space-y-2">
        <Label>Tools (Git, Docker, AWS…)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Docker"
            value={toolInput}
            onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTool() } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addTool}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {tools.map((t) => (
            <Badge key={t} variant="outline" className="gap-1">
              {t}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setTools((prev) => prev.filter((x) => x !== t))} />
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Languages */}
      <div className="space-y-2">
        <Label>Languages</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. English"
            value={langInput}
            onChange={(e) => setLangInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage() } }}
          />
          <Select value={langLevel} onValueChange={(v) => setLangLevel(v as Language['level'])}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANG_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={addLanguage}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {languages.map((l) => (
            <Badge key={l.language} variant="secondary" className="gap-1">
              {l.language} · {l.level}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setLanguages((prev) => prev.filter((x) => x.language !== l.language))} />
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Soft skills */}
      <div className="space-y-2">
        <Label>Soft skills</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Leadership"
            value={softInput}
            onChange={(e) => setSoftInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSoft() } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addSoft}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {soft.map((s) => (
            <Badge key={s} variant="outline" className="gap-1">
              {s}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSoft((prev) => prev.filter((x) => x !== s))} />
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  )
}
