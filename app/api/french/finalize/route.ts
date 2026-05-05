import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson } from '@/lib/store'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'
import type { FrenchSession } from '@/lib/checks'

export async function POST(req: NextRequest) {
  const { user_id, session_id, correct_count, total_count } = await req.json()
  const uid = Number(user_id)
  if (!Number.isFinite(uid)) return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })

  const sessions = await readJson<FrenchSession[]>(`french-sessions-${uid}.json`, [])
  const idx = sessions.findIndex(s => s.id === session_id)
  if (idx === -1) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const session = sessions[idx]
  const multiplier = session.point_multiplier ?? 1
  const mistakes = total_count - correct_count

  let points = correct_count * multiplier
  if (mistakes === 0 && total_count > 0) {
    const perfectBonus = total_count >= 20 ? 10 : 5
    points += perfectBonus * multiplier
  }

  const updated: FrenchSession[] = sessions.map((s, i) =>
    i === idx
      ? {
          ...s,
          ended_at: new Date().toISOString(),
          points,
          answers_summary: { total: total_count, mistakes, score: correct_count },
        }
      : s,
  )
  await writeJson(`french-sessions-${uid}.json`, updated)
  await recomputePracticeEarnLedger(uid)

  return NextResponse.json({ ok: true, points })
}
