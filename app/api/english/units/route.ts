import { NextResponse } from 'next/server'
import englishVocab from '@/data/english-vocab.json'

export async function GET() {
  const unitMap = new Map<number, { unit: number; unit_title: string; count: number }>()
  for (const v of englishVocab) {
    if (!unitMap.has(v.unit)) {
      unitMap.set(v.unit, { unit: v.unit, unit_title: v.unit_title, count: 0 })
    }
    unitMap.get(v.unit)!.count++
  }
  const units = Array.from(unitMap.values()).sort((a, b) => a.unit - b.unit)
  return NextResponse.json(units)
}
