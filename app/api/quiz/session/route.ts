import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'

interface QuizSession {
  id: number
  units: string
  mode: string
  duration_seconds: number
  completed_at: string
}

export async function POST(req: NextRequest) {
  const { user_id, units, mode, duration_seconds } = await req.json()
  const sessions = await readJson<QuizSession[]>(`quiz-sessions-${user_id}.json`, [])
  const entry: QuizSession = {
    id: nextId(sessions),
    units: JSON.stringify(units),
    mode,
    duration_seconds,
    completed_at: new Date().toISOString(),
  }
  await writeJson(`quiz-sessions-${user_id}.json`, [...sessions, entry])
  await recomputePracticeEarnLedger(Number(user_id))
  return NextResponse.json({ ok: true })
}
