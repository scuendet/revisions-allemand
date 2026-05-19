import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import verbs from '@/data/verbs.json'
import type { SubjectProgressSummary } from '@/lib/subjectProgress'

interface VerbResult {
  id: number
  verb_id: number
  correct_count: number
  attempted_at: string
}

interface VerbsSession {
  id: number
  duration_seconds: number
  completed_at: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId)
  const [results, sessions] = await Promise.all([
    readJson<VerbResult[]>(`verb-results-${userId}.json`, []),
    readJson<VerbsSession[]>(`verbs-sessions-${userId}.json`, []),
  ])

  const detail = verbs.map(v => {
    const vr = results.filter(r => r.verb_id === v.id)
    const avg = vr.length > 0
      ? Math.round((vr.reduce((s, r) => s + r.correct_count, 0) / vr.length) * 10) / 10
      : null
    return {
      verb_id: v.id,
      unit: v.unit,
      infinitive: v.infinitive,
      french: v.french,
      total_attempts: vr.length,
      avg_correct: avg,
      last_attempted: vr.length > 0 ? vr[vr.length - 1].attempted_at : null,
    }
  }).sort((a, b) => a.unit - b.unit || a.infinitive.localeCompare(b.infinitive))

  const summary: SubjectProgressSummary = {
    total_attempts: results.length,
    correct_attempts: results.filter(r => r.correct_count === 6).length,
    total_sessions: sessions.length,
    total_seconds: Math.round(sessions.reduce((s, q) => s + (q.duration_seconds ?? 0), 0)),
    last_attempted: results.length > 0 ? results[results.length - 1].attempted_at : null,
  }

  return NextResponse.json({ summary, detail })
}
