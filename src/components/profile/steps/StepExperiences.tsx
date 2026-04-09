'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import type { Experience } from '@/types'

interface Props {
  defaultValues?: Experience[]
  onBack: () => void
  onNext: (values: Experience[]) => void
}

const emptyExperience = (): Experience => ({
  id: uuidv4(),
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  description: '',
  stack: [],
})

export function StepExperiences({ defaultValues, onBack, onNext }: Props) {
  const [experiences, setExperiences] = useState<Experience[]>(
    defaultValues ?? [emptyExperience()]
  )
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({})

  function update(id: string, field: keyof Experience, value: unknown) {
    setExperiences((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  function addTag(id: string) {
    const tag = (tagInputs[id] ?? '').trim()
    if (!tag) return
    const exp = experiences.find((e) => e.id === id)
    if (!exp || exp.stack.includes(tag)) return
    update(id, 'stack', [...exp.stack, tag])
    setTagInputs((prev) => ({ ...prev, [id]: '' }))
  }

  function removeTag(id: string, tag: string) {
    const exp = experiences.find((e) => e.id === id)
    if (!exp) return
    update(id, 'stack', exp.stack.filter((t) => t !== tag))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext(experiences.filter((ex) => ex.company && ex.role))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {experiences.map((exp, idx) => (
        <div key={exp.id} className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Experience {idx + 1}</span>
            {experiences.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExperiences((prev) => prev.filter((e) => e.id !== exp.id))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Company *</Label>
              <Input value={exp.company} onChange={(e) => update(exp.id, 'company', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Input value={exp.role} onChange={(e) => update(exp.id, 'role', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Start date (YYYY-MM)</Label>
              <Input placeholder="2022-01" value={exp.startDate} onChange={(e) => update(exp.id, 'startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End date (YYYY-MM or &quot;current&quot;)</Label>
              <Input placeholder="2024-06 or current" value={exp.endDate} onChange={(e) => update(exp.id, 'endDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={exp.description}
              onChange={(e) => update(exp.id, 'description', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Tech stack</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add technology"
                value={tagInputs[exp.id] ?? ''}
                onChange={(e) => setTagInputs((prev) => ({ ...prev, [exp.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(exp.id) } }}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => addTag(exp.id)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {exp.stack.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {exp.stack.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(exp.id, tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setExperiences((prev) => [...prev, emptyExperience()])}
      >
        <Plus className="w-4 h-4 mr-2" /> Add experience
      </Button>

      <Separator />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  )
}
