import { NextRequest, NextResponse } from 'next/server'
import { sortedLedgerDesc } from '@/lib/checkLedger'
import { aggregatePracticeTotals, readRedemptions, POINTS_PER_CHECK, MATH_CORRECTS_PER_POINT } from '@/lib/checks'

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId, 10)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  try {
    const totals = await aggregatePracticeTotals(userId)
    const redemptionsRaw = await readRedemptions(userId)
    const usedChecks = redemptionsRaw.reduce((sum, r) => sum + r.checks_used, 0)
    const remainderPoints = totals.totalPoints % POINTS_PER_CHECK

    const redemptions = [...redemptionsRaw].sort((a, b) => b.created_at.localeCompare(a.created_at))

    const ledger = await sortedLedgerDesc(userId)

    // Use the ledger as the authoritative source for earned checks — it processes
    // events chronologically and handles all subjects, so it always stays in sync
    // with the displayed history entries.
    const earnedChecks = ledger.filter(e => e.kind === 'earn').reduce((s, e) => s + e.checks, 0)
    const spendUndoChecks = ledger.filter(e => e.kind === 'spend_undo').reduce((s, e) => s + e.checks, 0)
    const availableChecks = Math.max(earnedChecks - usedChecks + spendUndoChecks, 0)

    return NextResponse.json({
      pointsPerCheck: POINTS_PER_CHECK,
      mathCorrectsPerPoint: MATH_CORRECTS_PER_POINT,
      ...totals,
      earnedChecks,
      usedChecks,
      availableChecks,
      remainderPoints,
      redemptions,
      ledger,
    })
  } catch (err) {
    console.error('[checks GET]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
