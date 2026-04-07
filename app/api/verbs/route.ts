import { NextResponse } from 'next/server'
import verbs from '@/data/verbs.json'

export async function GET() {
  const sorted = [...verbs].sort((a, b) => a.unit - b.unit || a.infinitive.localeCompare(b.infinitive))
  return NextResponse.json(sorted)
}
