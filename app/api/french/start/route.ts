import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'
import type { FrenchSession } from '@/lib/checks'

interface FrenchQuestion {
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
}

interface FrenchResult {
  id: number
  verb: string
  tense: string
  pronoun: string
  is_correct: boolean
  asked_at: string
}

const DIFFICULTY_RATIOS: Record<string, number> = {
  easy: 0.2,
  medium: 0.5,
  hard: 0.8,
}

const MULTIPLIERS: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 5,
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function qKey(q: { verb: string; tense: string; pronoun: string }) {
  return `${q.verb}|${q.tense}|${q.pronoun}`
}

export async function POST(req: NextRequest) {
  const { user_id, verbs, tenses, count = 10, difficulty = 'easy' } = await req.json()
  const uid = Number(user_id)
  if (!Number.isFinite(uid)) return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })

  const allQuestions = await readJson<FrenchQuestion[]>('french-verbs.json', [])

  let pool = allQuestions
  if (Array.isArray(verbs) && verbs.length > 0) {
    pool = pool.filter(q => verbs.includes(q.verb))
  }
  if (Array.isArray(tenses) && tenses.length > 0) {
    pool = pool.filter(q => tenses.includes(q.tense))
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: 'No questions match the selection' }, { status: 400 })
  }
  const requestedCount =
    count === 'all'
      ? pool.length
      : typeof count === 'number' && Number.isFinite(count)
        ? Math.max(1, Math.floor(count))
        : 10

  const pastResults = await readJson<FrenchResult[]>(`french-results-${uid}.json`, [])

  // Build latest-result map per question key
  const latestByKey = new Map<string, { is_correct: boolean; asked_at: string }>()
  for (const r of pastResults) {
    const k = `${r.verb}|${r.tense}|${r.pronoun}`
    const existing = latestByKey.get(k)
    if (!existing || r.asked_at > existing.asked_at) {
      latestByKey.set(k, { is_correct: r.is_correct, asked_at: r.asked_at })
    }
  }

  const wrongOrUnseen = shuffle(pool.filter(q => {
    const rec = latestByKey.get(qKey(q))
    return !rec || !rec.is_correct
  }))
  const mastered = shuffle(pool.filter(q => {
    const rec = latestByKey.get(qKey(q))
    return rec?.is_correct === true
  }))

  const selected =
    count === 'all'
      ? shuffle(pool)
      : (() => {
          const newWrongRatio = DIFFICULTY_RATIOS[difficulty] ?? 0.5
          const newWrongCount = Math.min(Math.round(requestedCount * newWrongRatio), wrongOrUnseen.length)
          const masteredCount = Math.min(requestedCount - newWrongCount, mastered.length)
          const remaining = requestedCount - newWrongCount - masteredCount
          return shuffle([
            ...wrongOrUnseen.slice(0, newWrongCount + remaining),
            ...mastered.slice(0, masteredCount),
          ]).slice(0, requestedCount)
        })()

  const multiplier = MULTIPLIERS[difficulty] ?? 1
  const sessions = await readJson<FrenchSession[]>(`french-sessions-${uid}.json`, [])
  const session: FrenchSession = {
    id: nextId(sessions),
    started_at: new Date().toISOString(),
    mode: 'web_app',
    points: 0,
    point_multiplier: multiplier,
    difficulty,
  }
  await writeJson(`french-sessions-${uid}.json`, [...sessions, session])

  return NextResponse.json({ session_id: session.id, questions: selected })
}
