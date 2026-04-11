'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { StepPersonal } from './steps/StepPersonal'
import { StepObjective } from './steps/StepObjective'
import { StepExperiences } from './steps/StepExperiences'
import { StepEducation } from './steps/StepEducation'
import { StepSkills } from './steps/StepSkills'
import { StepAgentConfig } from './steps/StepAgentConfig'
import { saveProfileAction } from '@/app/actions/profile'
import type { UserProfile } from '@/types'

const STEPS = ['Personal Info', 'Objective', 'Experience', 'Education', 'Skills', 'Agent Config']

type PartialProfile = Partial<Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>>

interface ProfileFormProps {
  initialData?: PartialProfile
  title: string
  subtitle: string
}

export function ProfileForm({ initialData = {}, title, subtitle }: ProfileFormProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<PartialProfile>(initialData)
  const [saving, setSaving] = useState(false)

  function advance(stepData: Partial<PartialProfile>) {
    setData((prev) => ({ ...prev, ...stepData }))
    setStep((s) => s + 1)
  }

  async function finish(stepData: Partial<PartialProfile>) {
    const final = { ...data, ...stepData } as Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>
    setSaving(true)
    try {
      await saveProfileAction(final)
      router.push('/applications')
    } catch (err) {
      console.error('[ProfileForm] save failed:', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  const stepComponents = [
    <StepPersonal
      key="personal"
      defaultValues={data.personal}
      onNext={(v) => advance({ personal: v })}
    />,
    <StepObjective
      key="objective"
      defaultValues={data.objective}
      onBack={() => setStep(1)}
      onNext={(v) => advance({ objective: v })}
    />,
    <StepExperiences
      key="experiences"
      defaultValues={data.experiences}
      onBack={() => setStep(1)}
      onNext={(v) => advance({ experiences: v })}
    />,
    <StepEducation
      key="education"
      defaultValues={data.education}
      onBack={() => setStep(2)}
      onNext={(v) => advance({ education: v })}
    />,
    <StepSkills
      key="skills"
      defaultValues={data.skills}
      onBack={() => setStep(3)}
      onNext={(v) => advance({ skills: v })}
    />,
    <StepAgentConfig
      key="agentConfig"
      defaultValues={data.agentConfig}
      onBack={() => setStep(4)}
      onFinish={(v) => finish({ agentConfig: v })}
      saving={saving}
    />,
  ]

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <Progress value={progress} />
        </div>

        {stepComponents[step]}
      </div>
    </div>
  )
}
