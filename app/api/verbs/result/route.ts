import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'

interface VerbResult {
  id: number
  verb_id: number
  correct_count: number
  attempted_at: string
}

export async function POST(req: NextRequest) {
  const { user_id, verb_id, correct_count } = await req.json()
  const results = await readJson<VerbResult[]>(`verb-results-${user_id}.json`, [])
  const entry: VerbResult = {
    id: nextId(results),
    verb_id,
    correct_count,
    attempted_at: new Date().toISOString(),
  }
  await writeJson(`verb-results-${user_id}.json`, [...results, entry])
  return NextResponse.json({ ok: true })
}
