import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'

interface FrenchResult {
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

export async function POST(req: NextRequest) {
  const { user_id, session_id, verb, tense, pronoun, correct_answer, answer_given, is_correct } =
    await req.json()

  const results = await readJson<FrenchResult[]>(`french-results-${user_id}.json`, [])
  const entry: FrenchResult = {
    id: nextId(results),
    verb,
    tense,
    pronoun,
    correct_answer,
    answer_given: answer_given ?? undefined,
    correct: is_correct ? 1 : 0,
    mode: 'web_app',
    session_id: session_id ?? undefined,
    attempted_at: new Date().toISOString(),
  }
  await writeJson(`french-results-${user_id}.json`, [...results, entry])

  return NextResponse.json({ ok: true })
}
