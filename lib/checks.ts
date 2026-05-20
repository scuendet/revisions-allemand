import { readJson } from '@/lib/store'
import {
  MATH_CORRECTS_PER_POINT,
  MATH_PERFECT_SESSION_BONUS,
  POINTS_PER_CHECK,
} from '@/lib/checksConfig'

export { POINTS_PER_CHECK, MATH_CORRECTS_PER_POINT, MATH_PERFECT_SESSION_BONUS } from '@/lib/checksConfig'

export interface VocabPracticeResult {
  id: number
  vocab_id: number
  mode: string
  correct: number
  attempted_at: string
}

export interface VerbPracticeResult {
  id: number
  verb_id: number
  correct_count: number
  attempted_at: string
}

export interface TablePracticeResult {
  id: number
  correct: number
  attempted_at: string
}

/** Rows in `tables-sessions-{userId}.json`; only bonus is used for scoring. */
export interface TablesSessionStored {
  id?: number
  perfect_series_bonus?: number
}

export interface FrenchSession {
  id: number
  started_at: string
  ended_at?: string
  mode: string
  points: number
  point_multiplier?: number
  difficulty?: string
}

function clampSessionPerfectBonus(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(Math.floor(raw), MATH_PERFECT_SESSION_BONUS)
}

export interface CheckRedemption {
  id: number
  checks_used: number
  note: string
  created_at: string
}

export function redemptionsFilename(userId: number): string {
  return `check-redemptions-${userId}.json`
}

export async function aggregatePracticeTotals(userId: number): Promise<{
  germanCorrect_vocab: number
  germanCorrect_verbs: number
  germanCorrect: number
  mathCorrect: number
  mathPointsFromAnswers: number
  mathPerfectSessionBonusPoints: number
  germanPoints: number
  mathPoints: number
  frenchPoints: number
  totalPoints: number
}> {
  const vocabResults = await readJson<VocabPracticeResult[]>(`results-${userId}.json`, [])
  const englishResults = await readJson<VocabPracticeResult[]>(`english-results-${userId}.json`, [])
  const verbResults = await readJson<VerbPracticeResult[]>(`verb-results-${userId}.json`, [])
  const tableResults = await readJson<TablePracticeResult[]>(`tables-results-${userId}.json`, [])
  const tableSessions = await readJson<TablesSessionStored[]>(`tables-sessions-${userId}.json`, [])
  const frenchSessions = await readJson<FrenchSession[]>(`french-sessions-${userId}.json`, [])

  const germanCorrect_vocab = vocabResults.filter(r => r.correct === 1).length
  const englishCorrect_vocab = englishResults.filter(r => r.correct === 1).length
  const germanCorrect_verbs = verbResults.reduce((sum, r) => sum + r.correct_count, 0)
  const germanCorrect = germanCorrect_vocab + germanCorrect_verbs

  const mathCorrect = tableResults.filter(r => r.correct === 1).length
  const mathPerfectSessionBonusPoints = tableSessions.reduce(
    (sum, s) => sum + clampSessionPerfectBonus(s.perfect_series_bonus),
    0,
  )

  const germanPoints = germanCorrect + englishCorrect_vocab
  const mathPointsFromAnswers = Math.floor(mathCorrect / MATH_CORRECTS_PER_POINT)
  const mathPoints = mathPointsFromAnswers + mathPerfectSessionBonusPoints
  const frenchPoints = frenchSessions.reduce(
    (sum, s) => sum + (typeof s.points === 'number' && Number.isFinite(s.points) ? s.points : 0),
    0,
  )
  const totalPoints = germanPoints + mathPoints + frenchPoints

  return {
    germanCorrect_vocab,
    germanCorrect_verbs,
    germanCorrect,
    mathCorrect,
    mathPointsFromAnswers,
    mathPerfectSessionBonusPoints,
    germanPoints,
    mathPoints,
    frenchPoints,
    totalPoints,
  }
}

export async function readRedemptions(userId: number): Promise<CheckRedemption[]> {
  return readJson<CheckRedemption[]>(redemptionsFilename(userId), [])
}
