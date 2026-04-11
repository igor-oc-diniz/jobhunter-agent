import { DELAYS } from '@/lib/constants/agent'

export function humanDelay(
  minMs: number = DELAYS.HUMAN_MIN,
  maxMs: number = DELAYS.HUMAN_MAX
): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function platformDelay(): Promise<void> {
  return humanDelay(DELAYS.PLATFORM_MIN, DELAYS.PLATFORM_MAX)
}
