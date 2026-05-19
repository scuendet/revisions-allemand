import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import type { SubjectProgressSummary } from '@/lib/subjectProgress'

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
  const [results, sessions] = await Promise.all([
    readJson<TableResult[]>(`tables-results-${userId}.json`, []),
    readJson<TableSession[]>(`tables-sessions-${userId}.json`, []),
  ])

  const byLeft = new Map<number, TableResult[]>()
  for (let left = 2; left <= 12; left++) byLeft.set(left, [])
  for (const r of results) {
    const bucket = byLeft.get(r.left)
    if (bucket) bucket.push(r)
  }

  const detail = Array.from(byLeft.entries()).map(([table, rows]) => ({
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
  const correctAttempts = results.filter(r => r.correct === 1).length
  const totalSeconds = Math.round(sessions.reduce((s, q) => s + (Number.isFinite(q.duration_seconds) ? q.duration_seconds : 0), 0))
  const lastAttempted = results.length > 0 ? results[results.length - 1].attempted_at : null

  const summary: SubjectProgressSummary & {
    timer_attempts: number
    timer_correct: number
  } = {
    total_attempts: totalAttempts,
    correct_attempts: correctAttempts,
    total_sessions: sessions.length,
    total_seconds: totalSeconds,
    last_attempted: lastAttempted,
    timer_attempts: results.filter(r => r.timer_enabled).length,
    timer_correct: results.filter(r => r.timer_enabled && r.correct === 1).length,
  }

  return NextResponse.json({ summary, detail })
}
