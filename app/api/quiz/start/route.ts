import { NextRequest, NextResponse } from 'next/server'
import vocab from '@/data/vocab.json'
import { readJson } from '@/lib/store'
import {
  pickGermanVocabQuestions,
  type GermanVocabWord,
  type VocabResultRow,
} from '@/lib/germanVocabSelection'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { units, count, user_id, mode } = body
  const smartRaw = body.smart
  if (!Array.isArray(units) || units.length === 0) {
    return NextResponse.json({ error: 'Units required' }, { status: 400 })
  }

  const filtered = (vocab as GermanVocabWord[]).filter(v => units.includes(v.unit))

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

  const results = hasUser ? await readJson<VocabResultRow[]>(`results-${uid}.json`, []) : []

  const picked = pickGermanVocabQuestions({
    filtered,
    count: countArg,
    smart,
    userId: hasUser ? uid : null,
    mode: typeof mode === 'string' ? mode : undefined,
    results,
  })

  return NextResponse.json(picked)
}
