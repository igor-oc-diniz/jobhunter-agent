'use client'

import { ProfileForm } from './ProfileForm'
import type { UserProfile } from '@/types'

interface ProfileEditorProps {
  initialProfile: UserProfile
}

export function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  return (
    <ProfileForm
      initialData={initialProfile}
      title="Edit Profile"
      subtitle="Update your information and agent settings"
    />
  )
}
