import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import {
  buildTablePool,
  normalizeTablesInput,
  pickTableQuestions,
  type TableResultRow,
} from '@/lib/tablesSelection'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const tables = normalizeTablesInput(body.tables)
  const pool = buildTablePool(tables)
  const requestedCount = body.count === 'all'
    ? pool.length
    : Number.isInteger(body.count)
      ? body.count
      : 10
  const count = Math.min(Math.max(requestedCount, 1), pool.length === 0 ? 1 : pool.length)

  const uid = Number(body.user_id)
  const hasUser = Number.isInteger(uid)
  const smartRaw = body.smart
  const smart =
    !hasUser ? false : smartRaw === false || smartRaw === 0 || smartRaw === '0' ? false : true

  const results = hasUser ? await readJson<TableResultRow[]>(`tables-results-${uid}.json`, []) : []

  const picked = pickTableQuestions({
    pool,
    count,
    smart,
    userId: hasUser ? uid : null,
    mode: typeof body.mode === 'string' ? body.mode : undefined,
    results,
  })

  return NextResponse.json(picked)
}
