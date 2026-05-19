import { NextResponse } from 'next/server'
import { readJson, writeJson } from '@/lib/store'

interface OldFrenchResult {
  id: number
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
  answer_given?: string
  is_correct?: boolean
  correct?: number
  mode: string
  session_id?: number
  asked_at?: string
  attempted_at?: string
}

interface NewFrenchResult {
  id: number
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
  answer_given?: string
  correct: number
  mode: string
  session_id?: number
  attempted_at: string
}

export async function POST(req: Request) {
  const { secret, user_ids } = await req.json()
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ids: number[] = Array.isArray(user_ids) ? user_ids : [1, 2, 3]
  const report: Record<number, { migrated: number; skipped: number }> = {}

  for (const uid of ids) {
    const rows = await readJson<OldFrenchResult[]>(`french-results-${uid}.json`, [])
    let migrated = 0
    let skipped = 0

    const updated: NewFrenchResult[] = rows.map(r => {
      const needsMigration = r.correct === undefined || r.attempted_at === undefined
      if (!needsMigration) { skipped++; return r as NewFrenchResult }
      migrated++
      return {
        id: r.id,
        verb: r.verb,
        tense: r.tense,
        pronoun: r.pronoun,
        correct_answer: r.correct_answer,
        ...(r.answer_given !== undefined && { answer_given: r.answer_given }),
        correct: r.correct !== undefined ? r.correct : (r.is_correct ? 1 : 0),
        mode: r.mode,
        ...(r.session_id !== undefined && { session_id: r.session_id }),
        attempted_at: r.attempted_at ?? r.asked_at ?? new Date().toISOString(),
      }
    })

    if (migrated > 0) await writeJson(`french-results-${uid}.json`, updated)
    report[uid] = { migrated, skipped }
  }

  return NextResponse.json({ ok: true, report })
}
