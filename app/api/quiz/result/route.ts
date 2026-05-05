import { NextRequest, NextResponse } from 'next/server'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'
import { readJson, writeJson, nextId } from '@/lib/store'

interface Result {
  id: number
  vocab_id: number
  mode: string
  correct: number
  attempted_at: string
}

export async function POST(req: NextRequest) {
  const { user_id, vocab_id, mode, correct } = await req.json()
  const uid = Number(user_id)

  const results = await readJson<Result[]>(`results-${user_id}.json`, [])
  const entry: Result = {
    id: nextId(results),
    vocab_id,
    mode,
    correct: correct ? 1 : 0,
    attempted_at: new Date().toISOString(),
  }
  await writeJson(`results-${user_id}.json`, [...results, entry])

  if (Number.isFinite(uid)) {
    await recomputePracticeEarnLedger(uid)
  }
  return NextResponse.json({ ok: true })
}
