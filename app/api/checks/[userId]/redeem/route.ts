import { NextRequest, NextResponse } from 'next/server'
import { appendSpendLedger } from '@/lib/checkLedger'
import {
  aggregatePracticeTotals,
  readRedemptions,
  redemptionsFilename,
  POINTS_PER_CHECK,
  type CheckRedemption,
} from '@/lib/checks'
import { nextId, writeJson } from '@/lib/store'

async function availableChecksNow(userId: number): Promise<number> {
  const totals = await aggregatePracticeTotals(userId)
  const redemptions = await readRedemptions(userId)
  const used = redemptions.reduce((s, r) => s + r.checks_used, 0)
  const earned = Math.floor(totals.totalPoints / POINTS_PER_CHECK)
  return Math.max(earned - used, 0)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId, 10)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  let body: { checks_used?: number; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const checksUsed = Math.floor(Number(body.checks_used))
  const note = (body.note ?? '').trim()

  if (!Number.isFinite(checksUsed) || checksUsed < 1) {
    return NextResponse.json({ error: 'Nombre de chèques invalide.' }, { status: 400 })
  }
  if (!note) {
    return NextResponse.json({ error: 'Une note est requise (pour le registre famille).' }, { status: 400 })
  }

  const available = await availableChecksNow(userId)
  if (checksUsed > available) {
    return NextResponse.json(
      {
        error:
          available === 0
            ? 'Pas encore de chèques disponibles — continue à t’entraîner !'
            : `Tu peux échanger au plus ${available} chèque(s) pour l’instant.`,
      },
      { status: 400 }
    )
  }

  const list = await readRedemptions(userId)
  const entry: CheckRedemption = {
    id: nextId(list),
    checks_used: checksUsed,
    note,
    created_at: new Date().toISOString(),
  }
  await writeJson(redemptionsFilename(userId), [...list, entry])
  await appendSpendLedger(userId, entry)
  return NextResponse.json({ ok: true, redemption: entry })
}
