import { NextRequest, NextResponse } from 'next/server'
import verbs from '@/data/verbs.json'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const { count, units } = await req.json()
  const filtered = units && units.length > 0
    ? verbs.filter(v => units.includes(v.unit) || v.unit === 0)
    : [...verbs]
  const shuffled = shuffle(filtered).slice(0, count || filtered.length)
  return NextResponse.json(shuffled)
}
