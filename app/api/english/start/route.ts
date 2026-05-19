import { NextRequest, NextResponse } from 'next/server'
import englishVocab from '@/data/english-vocab.json'
import { readJson } from '@/lib/store'
import {
  pickEnglishVocabQuestions,
  type EnglishVocabWord,
  type EnglishResultRow,
} from '@/lib/englishVocabSelection'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { units, count, user_id, mode } = body
  const smartRaw = body.smart
  if (!Array.isArray(units) || units.length === 0) {
    return NextResponse.json({ error: 'Units required' }, { status: 400 })
  }

  const filtered = (englishVocab as EnglishVocabWord[]).filter(v => units.includes(v.unit))

  const countArg: number | 'all' =
    count === 'all'
      ? 'all'
      : typeof count === 'number' && Number.isFinite(count)
        ? count
        : 10

  const uid = Number(user_id)
  const hasUser = Number.isInteger(uid)
  const smart =
    !hasUser
      ? false
      : smartRaw === false || smartRaw === 0 || smartRaw === '0'
        ? false
        : true

  const results = hasUser ? await readJson<EnglishResultRow[]>(`english-results-${uid}.json`, []) : []

  const picked = pickEnglishVocabQuestions({
    filtered,
    count: countArg,
    smart,
    userId: hasUser ? uid : null,
    mode: typeof mode === 'string' ? mode : undefined,
    results,
  })

  return NextResponse.json(picked)
}
