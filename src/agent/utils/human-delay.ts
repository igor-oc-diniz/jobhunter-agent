export function humanDelay(minMs = 2000, maxMs = 8000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function platformDelay(): Promise<void> {
  return humanDelay(10000, 30000)
}
