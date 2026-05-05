import { NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import {
  buildFrenchDashboardPayload,
  type FrenchQuestionRow,
  type FrenchResultRow,
  type FrenchSessionRow,
} from '@/lib/frenchDashboard'

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
  return NextResponse.json(payload)
}
