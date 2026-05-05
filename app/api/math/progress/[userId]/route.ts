import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'

interface TableResult {
  id: number
  left: number
  right: number
  expected_answer: number
  mode: 'flashcard' | 'audio' | 'typing'
  timer_enabled: boolean
  correct: number
  attempted_at: string
}

interface TableSession {
  id: number
  tables: string
  mode: 'flashcard' | 'audio' | 'typing'
  timer_enabled: boolean
  duration_seconds: number
  perfect_series_bonus?: number
  completed_at: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId)
  const results = await readJson<TableResult[]>(`tables-results-${userId}.json`, [])
  const sessions = await readJson<TableSession[]>(`tables-sessions-${userId}.json`, [])

  const byLeft = new Map<number, TableResult[]>()
  for (let left = 2; left <= 12; left++) byLeft.set(left, [])
  for (const r of results) {
    const bucket = byLeft.get(r.left)
    if (bucket) bucket.push(r)
  }

  const byTable = Array.from(byLeft.entries()).map(([table, rows]) => ({
    table,
    attempts: rows.length,
    correct: rows.filter(r => r.correct === 1).length,
    flashcard_attempts: rows.filter(r => r.mode === 'flashcard').length,
    audio_attempts: rows.filter(r => r.mode === 'audio').length,
    typing_attempts: rows.filter(r => r.mode === 'typing').length,
    timer_attempts: rows.filter(r => r.timer_enabled).length,
    timer_correct: rows.filter(r => r.timer_enabled && r.correct === 1).length,
    last_attempted: rows.length > 0 ? rows[rows.length - 1].attempted_at : null,
  }))

  const totalAttempts = results.length
  const totalCorrect = results.filter(r => r.correct === 1).length
  const timerAttempts = results.filter(r => r.timer_enabled).length
  const timerCorrect = results.filter(r => r.timer_enabled && r.correct === 1).length
  const totalSeconds = sessions.reduce((sum, s) => sum + (Number.isFinite(s.duration_seconds) ? s.duration_seconds : 0), 0)

  return NextResponse.json({
    summary: {
      total_attempts: totalAttempts,
      total_correct: totalCorrect,
      total_seconds: Math.round(totalSeconds),
      timer_attempts: timerAttempts,
      timer_correct: timerCorrect,
      sessions: sessions.length,
    },
    by_table: byTable,
  })
}
