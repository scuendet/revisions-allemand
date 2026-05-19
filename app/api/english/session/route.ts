import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'
import { recomputePracticeEarnLedger } from '@/lib/checkLedger'

interface EnglishSession {
  id: number
  units: string
  mode: string
  duration_seconds: number
  completed_at: string
}

export async function POST(req: NextRequest) {
  const { user_id, units, mode, duration_seconds } = await req.json()
  const sessions = await readJson<EnglishSession[]>(`english-sessions-${user_id}.json`, [])
  const entry: EnglishSession = {
    id: nextId(sessions),
    units: JSON.stringify(units),
    mode,
    duration_seconds,
    completed_at: new Date().toISOString(),
  }
  await writeJson(`english-sessions-${user_id}.json`, [...sessions, entry])
  await recomputePracticeEarnLedger(Number(user_id))
  return NextResponse.json({ ok: true })
}
