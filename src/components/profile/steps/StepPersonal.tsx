'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { personalSchema, type PersonalFormValues } from '@/lib/validators/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserProfile } from '@/types'

interface Props {
  defaultValues?: UserProfile['personal']
  onNext: (values: UserProfile['personal']) => void
}

export function StepPersonal({ defaultValues, onNext }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalFormValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: defaultValues ?? {},
  })

  return (
    <form onSubmit={handleSubmit((v) => onNext(v as UserProfile['personal']))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" {...register('fullName')} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" {...register('phone')} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="city">City *</Label>
          <Input id="city" {...register('city')} />
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="state">State *</Label>
          <Input id="state" {...register('state')} />
          {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country *</Label>
          <Input id="country" {...register('country')} defaultValue="Brazil" />
          {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
        <Input id="linkedinUrl" placeholder="https://linkedin.com/in/yourprofile" {...register('linkedinUrl')} />
        {errors.linkedinUrl && <p className="text-xs text-destructive">{errors.linkedinUrl.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="githubUrl">GitHub URL</Label>
        <Input id="githubUrl" placeholder="https://github.com/yourhandle" {...register('githubUrl')} />
        {errors.githubUrl && <p className="text-xs text-destructive">{errors.githubUrl.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="portfolioUrl">Portfolio URL</Label>
        <Input id="portfolioUrl" placeholder="https://yourportfolio.com" {...register('portfolioUrl')} />
        {errors.portfolioUrl && <p className="text-xs text-destructive">{errors.portfolioUrl.message}</p>}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">Next</Button>
      </div>
    </form>
  )
}
