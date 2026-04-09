'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { objectiveSchema, type ObjectiveFormValues } from '@/lib/validators/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserProfile } from '@/types'

interface Props {
  defaultValues?: UserProfile['objective']
  onBack: () => void
  onNext: (values: UserProfile['objective']) => void
}

export function StepObjective({ defaultValues, onBack, onNext }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ObjectiveFormValues>({
    resolver: zodResolver(objectiveSchema),
    defaultValues: defaultValues ?? { salaryMin: 0, salaryMax: 0, availabilityDays: 0 },
  })

  return (
    <form onSubmit={handleSubmit((v) => onNext(v as UserProfile['objective']))} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="desiredRole">Desired role *</Label>
        <Input id="desiredRole" placeholder="e.g. Senior Frontend Developer" {...register('desiredRole')} />
        {errors.desiredRole && <p className="text-xs text-destructive">{errors.desiredRole.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Seniority *</Label>
          <Select
            defaultValue={defaultValues?.seniority}
            onValueChange={(v) => setValue('seniority', v as ObjectiveFormValues['seniority'])}
          >
            <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="specialist">Specialist</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Modality *</Label>
          <Select
            defaultValue={defaultValues?.modality}
            onValueChange={(v) => setValue('modality', v as ObjectiveFormValues['modality'])}
          >
            <SelectTrigger><SelectValue placeholder="Select modality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Contract type *</Label>
          <Select
            defaultValue={defaultValues?.contractType}
            onValueChange={(v) => setValue('contractType', v as ObjectiveFormValues['contractType'])}
          >
            <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="clt">CLT</SelectItem>
              <SelectItem value="pj">PJ</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="availabilityDays">Availability (days)</Label>
          <Input id="availabilityDays" type="number" min={0} {...register('availabilityDays')} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="salaryMin">Min salary (BRL) *</Label>
          <Input id="salaryMin" type="number" min={0} {...register('salaryMin')} />
          {errors.salaryMin && <p className="text-xs text-destructive">{errors.salaryMin.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="salaryMax">Max salary (BRL) *</Label>
          <Input id="salaryMax" type="number" min={0} {...register('salaryMax')} />
          {errors.salaryMax && <p className="text-xs text-destructive">{errors.salaryMax.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="professionalSummary">Professional summary *</Label>
        <Textarea
          id="professionalSummary"
          rows={4}
          placeholder="3–5 lines summarizing your experience and what you're looking for"
          {...register('professionalSummary')}
        />
        {errors.professionalSummary && (
          <p className="text-xs text-destructive">{errors.professionalSummary.message}</p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  )
}
