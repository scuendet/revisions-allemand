import { NextRequest, NextResponse } from 'next/server'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'
import { nextId, readJson, writeJson } from '@/lib/store'

type TablesMode = 'flashcard' | 'audio' | 'typing'

interface TableResult {
  id: number
  question_key: string
  left: number
  right: number
  expected_answer: number
  mode: TablesMode
  timer_enabled: boolean
  correct: number
  attempted_at: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = Number(body.user_id)

  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
  }

  const mode = body.mode as TablesMode
  if (!['flashcard', 'audio', 'typing'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const left = Number(body.left)
  const right = Number(body.right)
  const expectedAnswer = Number(body.expected_answer)

  if (!Number.isInteger(left) || !Number.isInteger(right) || !Number.isInteger(expectedAnswer)) {
    return NextResponse.json({ error: 'Invalid question payload' }, { status: 400 })
  }

  const results = await readJson<TableResult[]>(`tables-results-${userId}.json`, [])
  const entry: TableResult = {
    id: nextId(results),
    question_key: `${left}x${right}`,
    left,
    right,
    expected_answer: expectedAnswer,
    mode,
    timer_enabled: !!body.timer_enabled,
    correct: body.correct ? 1 : 0,
    attempted_at: new Date().toISOString(),
  }

  await writeJson(`tables-results-${userId}.json`, [...results, entry])

  await recomputePracticeEarnLedger(userId)
  return NextResponse.json({ ok: true })
}
