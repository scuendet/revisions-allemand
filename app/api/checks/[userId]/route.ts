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

  const totals = await aggregatePracticeTotals(userId)
  const redemptionsRaw = await readRedemptions(userId)
  const usedChecks = redemptionsRaw.reduce((sum, r) => sum + r.checks_used, 0)
  const earnedChecks = Math.floor(totals.totalPoints / POINTS_PER_CHECK)
  const availableChecks = Math.max(earnedChecks - usedChecks, 0)
  const remainderPoints = totals.totalPoints % POINTS_PER_CHECK

  const redemptions = [...redemptionsRaw].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const ledger = await sortedLedgerDesc(userId)

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
}
