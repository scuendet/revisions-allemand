import { NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import {
  buildFrenchDashboardPayload,
  type FrenchQuestionRow,
  type FrenchResultRow,
  type FrenchSessionRow,
} from '@/lib/frenchDashboard'
import type { SubjectProgressSummary } from '@/lib/subjectProgress'

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const uid = Number(params.userId)
  if (!Number.isFinite(uid)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
  }

  const [catalog, results, sessions] = await Promise.all([
    readJson<FrenchQuestionRow[]>('french-verbs.json', []),
    readJson<FrenchResultRow[]>(`french-results-${uid}.json`, []),
    readJson<FrenchSessionRow[]>(`french-sessions-${uid}.json`, []),
  ])

  const payload = buildFrenchDashboardPayload(catalog, results, sessions)

  const summary: SubjectProgressSummary = {
    total_attempts: results.length,
    correct_attempts: results.filter(r => r.correct === 1).length,
    total_sessions: sessions.filter(s => s.ended_at).length,
    total_seconds: Math.round(sessions.reduce((s, fs) => {
      if (!fs.ended_at || !fs.started_at) return s
      return s + (new Date(fs.ended_at).getTime() - new Date(fs.started_at).getTime()) / 1000
    }, 0)),
    last_attempted: results.length > 0 ? results[results.length - 1].attempted_at : null,
  }

  return NextResponse.json({ summary, detail: payload })
}
