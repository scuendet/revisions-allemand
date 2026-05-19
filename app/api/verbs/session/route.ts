import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'

interface VerbsSession {
  id: number
  verb_count: number
  duration_seconds: number
  completed_at: string
}

export async function POST(req: NextRequest) {
  const { user_id, verb_count, duration_seconds } = await req.json()
  const uid = Number(user_id)
  if (!Number.isFinite(uid)) {
    return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
  }

  const sessions = await readJson<VerbsSession[]>(`verbs-sessions-${uid}.json`, [])
  const entry: VerbsSession = {
    id: nextId(sessions),
    verb_count: Number.isFinite(verb_count) ? Math.max(0, Math.floor(verb_count)) : 0,
    duration_seconds: Number.isFinite(duration_seconds) ? Math.max(0, Math.floor(duration_seconds)) : 0,
    completed_at: new Date().toISOString(),
  }

  await writeJson(`verbs-sessions-${uid}.json`, [...sessions, entry])
  await recomputePracticeEarnLedger(uid)

  return NextResponse.json({ ok: true })
}
