import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'

interface FrenchResult {
  id: number
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
  answer_given?: string
  is_correct: boolean
  mode: string
  session_id?: number
  asked_at: string
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
    is_correct: Boolean(is_correct),
    mode: 'web_app',
    session_id: session_id ?? undefined,
    asked_at: new Date().toISOString(),
  }
  await writeJson(`french-results-${user_id}.json`, [...results, entry])

  return NextResponse.json({ ok: true })
}
