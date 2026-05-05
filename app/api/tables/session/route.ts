import { NextRequest, NextResponse } from 'next/server'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'
import { MATH_PERFECT_SESSION_BONUS } from '@/lib/checksConfig'
import { nextId, readJson, writeJson } from '@/lib/store'

type TablesMode = 'flashcard' | 'audio' | 'typing'

interface TableSession {
  id: number
  tables: string
  mode: TablesMode
  timer_enabled: boolean
  duration_seconds: number
  /** 0 or 5 — bonus compté pour la banque de chèques si toute la série était juste */
  perfect_series_bonus: number
  completed_at: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = Number(body.user_id)
  const mode = body.mode as TablesMode
  const durationSeconds = Number(body.duration_seconds)

  if (!Number.isInteger(userId) || !['flashcard', 'audio', 'typing'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const allCorrectSeries = body.all_correct_series === true || body.all_correct_series === 'true'
  const bonus = allCorrectSeries ? MATH_PERFECT_SESSION_BONUS : 0

  const sessions = await readJson<TableSession[]>(`tables-sessions-${userId}.json`, [])
  const entry: TableSession = {
    id: nextId(sessions),
    tables: JSON.stringify(Array.isArray(body.tables) ? body.tables : []),
    mode,
    timer_enabled: !!body.timer_enabled,
    duration_seconds: Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 0,
    perfect_series_bonus: bonus,
    completed_at: new Date().toISOString(),
  }

  await writeJson(`tables-sessions-${userId}.json`, [...sessions, entry])

  await recomputePracticeEarnLedger(userId)

  return NextResponse.json({ ok: true })
}
