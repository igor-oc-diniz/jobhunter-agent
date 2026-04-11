'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfileAction } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StepPersonal } from './steps/StepPersonal'
import { StepObjective } from './steps/StepObjective'
import { StepExperiences } from './steps/StepExperiences'
import { StepEducation } from './steps/StepEducation'
import { StepSkills } from './steps/StepSkills'
import { StepAgentConfig } from './steps/StepAgentConfig'
import type { UserProfile } from '@/types'

const STEPS = [
  'Personal Info',
  'Objective',
  'Experience',
  'Education',
  'Skills',
  'Agent Config',
]

type PartialProfile = Partial<Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>>

export function ProfileWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<PartialProfile>({})
  const [saving, setSaving] = useState(false)

  function handleStepData(stepData: Partial<PartialProfile>) {
    setData((prev) => ({ ...prev, ...stepData }))
  }

  async function handleFinish(stepData: Partial<PartialProfile>) {
    const final = { ...data, ...stepData } as Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>

    setSaving(true)
    try {
      await saveProfileAction(final)
      router.push('/applications')
    } catch (err) {
      console.error('Failed to save profile', err)
    } finally {
      setSaving(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={progress} />
      </div>

      {step === 0 && (
        <StepPersonal
          defaultValues={data.personal}
          onNext={(v) => {
            handleStepData({ personal: v })
            setStep(1)
          }}
        />
      )}
      {step === 1 && (
        <StepObjective
          defaultValues={data.objective}
          onBack={() => setStep(0)}
          onNext={(v) => {
            handleStepData({ objective: v })
            setStep(2)
          }}
        />
      )}
      {step === 2 && (
        <StepExperiences
          defaultValues={data.experiences}
          onBack={() => setStep(1)}
          onNext={(v) => {
            handleStepData({ experiences: v })
            setStep(3)
          }}
        />
      )}
      {step === 3 && (
        <StepEducation
          defaultValues={data.education}
          onBack={() => setStep(2)}
          onNext={(v) => {
            handleStepData({ education: v })
            setStep(4)
          }}
        />
      )}
      {step === 4 && (
        <StepSkills
          defaultValues={data.skills}
          onBack={() => setStep(3)}
          onNext={(v) => {
            handleStepData({ skills: v })
            setStep(5)
          }}
        />
      )}
      {step === 5 && (
        <StepAgentConfig
          defaultValues={data.agentConfig}
          onBack={() => setStep(4)}
          onFinish={(v) => handleFinish({ agentConfig: v })}
          saving={saving}
        />
      )}

      {saving && (
        <div className="text-center text-sm text-muted-foreground">
          Saving your profile...
        </div>
      )}
    </div>
  )
}
