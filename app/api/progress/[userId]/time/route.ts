import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'

interface QuizSession {
  id: number
  units: string
  mode: string
  duration_seconds: number
  completed_at: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId)
  const sessions = await readJson<QuizSession[]>(`quiz-sessions-${userId}.json`, [])

  const timeByUnit = new Map<number, { total: number; flashcard: number; audio: number; typing: number }>()

  for (const session of sessions) {
    const units: number[] = JSON.parse(session.units)
    const perUnit = session.duration_seconds / units.length
    for (const unit of units) {
      if (!timeByUnit.has(unit)) {
        timeByUnit.set(unit, { total: 0, flashcard: 0, audio: 0, typing: 0 })
      }
      const entry = timeByUnit.get(unit)!
      entry.total += perUnit
      if (session.mode === 'flashcard') entry.flashcard += perUnit
      else if (session.mode === 'audio') entry.audio += perUnit
      else if (session.mode === 'typing') entry.typing += perUnit
    }
  }

  const result = Array.from(timeByUnit.entries()).map(([unit, t]) => ({
    unit,
    total_seconds: Math.round(t.total),
    flashcard_seconds: Math.round(t.flashcard),
    audio_seconds: Math.round(t.audio),
    typing_seconds: Math.round(t.typing),
  }))

  return NextResponse.json(result)
}
