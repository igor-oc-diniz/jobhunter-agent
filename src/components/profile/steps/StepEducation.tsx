'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { Education } from '@/types'

interface Props {
  defaultValues?: Education[]
  onBack: () => void
  onNext: (values: Education[]) => void
}

const emptyEducation = (): Education => ({
  id: uuidv4(),
  institution: '',
  course: '',
  degree: 'graduation',
  startDate: '',
  endDate: '',
  status: 'complete',
})

export function StepEducation({ defaultValues, onBack, onNext }: Props) {
  const [items, setItems] = useState<Education[]>(defaultValues ?? [emptyEducation()])

  function update(id: string, field: keyof Education, value: unknown) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext(items.filter((i) => i.institution && i.course))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {items.map((item, idx) => (
        <div key={item.id} className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Education {idx + 1}</span>
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Institution *</Label>
              <Input value={item.institution} onChange={(e) => update(item.id, 'institution', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Course *</Label>
              <Input value={item.course} onChange={(e) => update(item.id, 'course', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Degree</Label>
              <Select defaultValue={item.degree} onValueChange={(v) => update(item.id, 'degree', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="graduation">Graduation</SelectItem>
                  <SelectItem value="postgrad">Post-grad</SelectItem>
                  <SelectItem value="mba">MBA</SelectItem>
                  <SelectItem value="bootcamp">Bootcamp</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select defaultValue={item.status} onValueChange={(v) => update(item.id, 'status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start date (YYYY-MM)</Label>
              <Input placeholder="2018-03" value={item.startDate} onChange={(e) => update(item.id, 'startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End date (YYYY-MM or &quot;ongoing&quot;)</Label>
              <Input placeholder="2022-12 or ongoing" value={item.endDate} onChange={(e) => update(item.id, 'endDate', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setItems((prev) => [...prev, emptyEducation()])}
      >
        <Plus className="w-4 h-4 mr-2" /> Add education
      </Button>

      <Separator />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  )
}
