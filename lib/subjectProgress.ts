/** Canonical progress summary returned by every subject's progress API endpoint. */
export interface SubjectProgressSummary {
  total_attempts: number
  correct_attempts: number
  total_sessions: number
  total_seconds: number
  last_attempted: string | null
}
