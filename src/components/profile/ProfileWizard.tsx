'use client'

import { ProfileForm } from './ProfileForm'

export function ProfileWizard() {
  return (
    <ProfileForm
      title="Set up your profile"
      subtitle="Tell us about yourself so the agent can find the best jobs for you"
      showImportStep
    />
  )
}
