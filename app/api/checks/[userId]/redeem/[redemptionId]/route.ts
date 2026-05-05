import { NextRequest, NextResponse } from 'next/server'
import { appendSpendUndoLedger } from '@/lib/checkLedger'
import { readRedemptions, redemptionsFilename } from '@/lib/checks'
import { writeJson } from '@/lib/store'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string; redemptionId: string } }
) {
  const userId = parseInt(params.userId, 10)
  const redemptionId = parseInt(params.redemptionId, 10)
  if (!Number.isFinite(userId) || !Number.isFinite(redemptionId)) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 })
  }

  const list = await readRedemptions(userId)
  const removed = list.find(r => r.id === redemptionId)
  const next = list.filter(r => r.id !== redemptionId)
  if (!removed) {
    return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 })
  }

  await writeJson(redemptionsFilename(userId), next)
  await appendSpendUndoLedger(userId, redemptionId, removed.checks_used)
  return NextResponse.json({ ok: true })
}
