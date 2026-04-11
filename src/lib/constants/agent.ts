/** Delay ranges for human-like browser behaviour (ms) */
export const DELAYS = {
  HUMAN_MIN: 2_000,
  HUMAN_MAX: 8_000,
  PLATFORM_MIN: 10_000,
  PLATFORM_MAX: 30_000,
  FORM_FILL_MIN: 500,
  FORM_FILL_MAX: 1_500,
  CARD_FETCH_MIN: 1_000,
  CARD_FETCH_MAX: 3_000,
  PAGE_LOAD_TIMEOUT: 30_000,
  FORM_TIMEOUT: 30_000,
} as const

/** Expiry durations */
export const EXPIRY = {
  CV_SIGNED_URL_MS: 7 * 24 * 60 * 60 * 1_000, // 7 days
  CV_CACHE_MS: 24 * 60 * 60 * 1_000,           // 24 hours
  SCREENSHOT_SIGNED_URL_MS: 7 * 24 * 3_600_000, // 7 days
} as const

/** Orchestrator limits */
export const ORCHESTRATOR = {
  MAX_ITERATIONS: 50,
  MAX_LOG_ENTRIES: 100,
} as const

/** Matching thresholds */
export const MATCHING = {
  MIN_STACK_OVERLAP: 0.1,
  MAX_JOBS_BATCH: 20,
  DEFAULT_MIN_SCORE: 70,
} as const

/** Polling intervals (ms) */
export const POLLING = {
  KANBAN_MS: 30_000,
} as const
