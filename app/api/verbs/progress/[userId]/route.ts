import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import verbs from '@/data/verbs.json'

interface VerbResult {
  id: number
  verb_id: number
  correct_count: number
  attempted_at: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId)
  const results = await readJson<VerbResult[]>(`verb-results-${userId}.json`, [])

  const rows = verbs.map(v => {
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

  return NextResponse.json(rows)
}
