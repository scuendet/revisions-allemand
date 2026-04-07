import { NextRequest, NextResponse } from 'next/server'
import vocab from '@/data/vocab.json'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const { units, count } = await req.json()
  if (!Array.isArray(units) || units.length === 0) {
    return NextResponse.json({ error: 'Units required' }, { status: 400 })
  }
  const filtered = vocab.filter(v => units.includes(v.unit))
  const shuffled = shuffle(filtered).slice(0, count)
  return NextResponse.json(shuffled)
}
