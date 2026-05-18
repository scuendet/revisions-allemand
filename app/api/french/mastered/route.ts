import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'

interface FrenchQuestion {
  verb: string
  tense: string
  pronoun: string
}

interface FrenchResult {
  verb: string
  tense: string
  pronoun: string
  is_correct: boolean
  asked_at: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = Number(searchParams.get('userId'))
  if (!Number.isFinite(uid)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })

  const [catalog, pastResults] = await Promise.all([
    readJson<FrenchQuestion[]>('french-verbs.json', []),
    readJson<FrenchResult[]>(`french-results-${uid}.json`, []),
  ])

  // Keep only the most recent attempt per question key
  const latestByKey = new Map<string, { correct: boolean; at: string }>()
  for (const r of pastResults) {
    const k = `${r.verb}|${r.tense}|${r.pronoun}`
    const existing = latestByKey.get(k)
    if (!existing || r.asked_at > existing.at) {
      latestByKey.set(k, { correct: r.is_correct, at: r.asked_at })
    }
  }

  // For each verb|tense in the catalog, count total forms and how many are mastered
  const vtForms = new Map<string, { total: number; mastered: number }>()
  for (const q of catalog) {
    const vtKey = `${q.verb}|${q.tense}`
    const entry = vtForms.get(vtKey) ?? { total: 0, mastered: 0 }
    entry.total += 1
    if (latestByKey.get(`${q.verb}|${q.tense}|${q.pronoun}`)?.correct === true) {
      entry.mastered += 1
    }
    vtForms.set(vtKey, entry)
  }

  // Return verb|tense combos where at least one form is wrong or unseen
  const unmasteredVerbTenses: string[] = []
  for (const [vtKey, { total, mastered }] of vtForms) {
    if (mastered < total) unmasteredVerbTenses.push(vtKey)
  }

  return NextResponse.json({ unmasteredVerbTenses })
}
