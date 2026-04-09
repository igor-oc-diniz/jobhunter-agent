'use client'

import { useEffect, useState } from 'react'
import { getProfile } from '@/lib/firestore/profile'
import type { UserProfile } from '@/types'

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    getProfile(userId)
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [userId])

  return { profile, loading }
}
