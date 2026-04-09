import { ProfileWizard } from '@/components/profile/ProfileWizard'

export default function ProfileSetupPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="text-muted-foreground mt-1">
          Your profile is the foundation the agent uses for every application.
        </p>
      </div>
      <ProfileWizard />
    </div>
  )
}
