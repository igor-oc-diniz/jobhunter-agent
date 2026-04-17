'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { agentConfigSchema, type AgentConfigFormValues } from '@/lib/validators/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AgentConfig } from '@/types'

const PLATFORMS: { id: string; label: string }[] = [
  { id: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', label: 'Lever' },
  { id: 'remotive', label: 'Remotive' },
  { id: 'weworkremotely', label: 'We Work Remotely' },
  { id: 'himalayas', label: 'Himalayas' },
  { id: 'remoteok', label: 'RemoteOK' },
  { id: 'arbeitnow', label: 'Arbeitnow' },
  { id: 'wellfound', label: 'Wellfound' },
  { id: 'gupy', label: 'Gupy' },
  { id: 'indeed-br', label: 'Indeed BR' },
  { id: 'indeed-ca', label: 'Indeed CA' },
  { id: 'indeed-au', label: 'Indeed AU' },
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  defaultValues?: AgentConfig
  onBack: () => void
  onFinish: (values: AgentConfig) => void
  saving: boolean
}

const defaults: AgentConfigFormValues = {
  mode: 'semi-automatic',
  minScore: 70,
  maxApplicationsPerDay: 10,
  enabledPlatforms: ['greenhouse', 'lever', 'remotive', 'weworkremotely', 'himalayas', 'remoteok', 'arbeitnow', 'wellfound'],
  searchKeywords: [],
  excludeKeywords: [],
  scheduleHours: [9, 15],
  emailNotifications: true,
}

export function StepAgentConfig({ defaultValues, onBack, onFinish, saving }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AgentConfigFormValues>({
    resolver: zodResolver(agentConfigSchema),
    defaultValues: defaultValues ?? defaults,
  })

  const enabledPlatforms = watch('enabledPlatforms') ?? []
  const scheduleHours = watch('scheduleHours') ?? []

  function togglePlatform(p: string) {
    const current = enabledPlatforms
    setValue(
      'enabledPlatforms',
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p]
    )
  }

  function toggleHour(h: number) {
    const current = scheduleHours
    setValue(
      'scheduleHours',
      current.includes(h) ? current.filter((x) => x !== h) : [...current, h].sort((a, b) => a - b)
    )
  }

  return (
    <form onSubmit={handleSubmit((v) => onFinish(v as AgentConfig))} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Agent mode</Label>
          <Select
            defaultValue={defaultValues?.mode ?? 'semi-automatic'}
            onValueChange={(v) => setValue('mode', v as AgentConfigFormValues['mode'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semi-automatic">Semi-automatic (confirm before submit)</SelectItem>
              <SelectItem value="automatic">Automatic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="minScore">Minimum match score (0–100)</Label>
          <Input id="minScore" type="number" min={0} max={100} {...register('minScore')} />
          {errors.minScore && <p className="text-xs text-destructive">{errors.minScore.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="maxApplicationsPerDay">Max applications per day</Label>
          <Input id="maxApplicationsPerDay" type="number" min={1} max={50} {...register('maxApplicationsPerDay')} />
          {errors.maxApplicationsPerDay && (
            <p className="text-xs text-destructive">{errors.maxApplicationsPerDay.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Enabled platforms</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                enabledPlatforms.includes(p.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {errors.enabledPlatforms && (
          <p className="text-xs text-destructive">{errors.enabledPlatforms.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Schedule hours</Label>
        <div className="flex flex-wrap gap-2">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => toggleHour(h)}
              className={`w-10 h-10 rounded text-sm border transition-colors ${
                scheduleHours.includes(h)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Finish setup'}
        </Button>
      </div>
    </form>
  )
}
