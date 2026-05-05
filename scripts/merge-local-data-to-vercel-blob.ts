/**
 * One-way merge: local ./data/*.json progress is merged into Vercel Blob (production store),
 * combined with whatever is already remote, without losing either side.
 *
 * Requires BLOB_READ_WRITE_TOKEN in .env.local or .env (same as production).
 *
 * Usage: npx tsx scripts/merge-local-data-to-vercel-blob.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CheckLedgerEntry } from '../lib/checkLedger'
import type { CheckRedemption, FrenchSession } from '../lib/checks'

function loadEnvFiles(): void {
  for (const name of ['.env.local', '.env', '.env.vercel.pull']) {
    const p = path.join(process.cwd(), name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

function resolveBlobToken(): string {
  const direct = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (direct) return direct
  const suffix = 'BLOB_READ_WRITE_TOKEN'
  for (const key of Object.keys(process.env)) {
    if (key === suffix || key.endsWith(`_${suffix}`)) {
      const v = process.env[key]?.trim()
      if (v) return v
    }
  }
  return ''
}

const DATA_DIR = path.join(process.cwd(), 'data')

function readLocalJson<T>(filename: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')) as T
  } catch {
    return fallback
  }
}

async function blobGetJson<T>(token: string, filename: string, fallback: T): Promise<T> {
  const { get } = await import('@vercel/blob')
  try {
    const out = await get(filename, { access: 'private', token, useCache: false })
    if (!out || out.statusCode !== 200 || !out.stream) return fallback
    const text = await new Response(out.stream).text()
    if (!text.trim()) return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

async function blobPutJson(token: string, filename: string, data: unknown): Promise<void> {
  const { put } = await import('@vercel/blob')
  await put(filename, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token,
  })
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  const o = obj as Record<string, unknown>
  const keys = Object.keys(o).sort()
  return `{${keys.map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',')}}`
}

function fpOmit<T extends object>(row: T, omit: (keyof T)[]): string {
  const o = { ...row } as Record<string, unknown>
  for (const k of omit) delete o[String(k)]
  return stableStringify(o)
}

interface UserRow {
  id: number
  name: string
  created_at: string
}

/** Fallback `[]` needs a typed array so merge/sort callbacks are not `never`. */
interface RowWithAttemptedAt {
  id: number
  attempted_at: string
}

interface RowWithCompletedAt {
  id: number
  completed_at?: string
}

function mergeUsers(local: UserRow[], remote: UserRow[]): UserRow[] {
  const m = new Map<number, UserRow>()
  for (const u of remote) m.set(u.id, u)
  for (const u of local) {
    const e = m.get(u.id)
    if (!e) m.set(u.id, u)
    else {
      const tr = new Date(e.created_at).getTime()
      const tl = new Date(u.created_at).getTime()
      m.set(u.id, tl >= tr ? u : e)
    }
  }
  return [...m.values()].sort((a, b) => a.id - b.id)
}

function mergeRowsDedupeRemoteFirst<T extends { id: number }>(
  remote: T[],
  local: T[],
  omitKeys: (keyof T)[],
): T[] {
  type Tagged = { row: T; from: 'r' | 'l' }
  const tagged: Tagged[] = [
    ...remote.map(row => ({ row, from: 'r' as const })),
    ...local.map(row => ({ row, from: 'l' as const })),
  ]
  const seen = new Set<string>()
  const kept: Tagged[] = []
  for (const t of tagged) {
    const fp = fpOmit(t.row, omitKeys)
    if (seen.has(fp)) continue
    seen.add(fp)
    kept.push(t)
  }
  return kept.map(t => t.row)
}

function sortAndRenumberIds<T extends { id: number }>(rows: T[], sortKey: (a: T, b: T) => number): T[] {
  const sorted = [...rows].sort(sortKey)
  return sorted.map((r, i) => ({ ...r, id: i + 1 }))
}

function mergeFrenchSessions(
  remote: FrenchSession[],
  local: FrenchSession[],
): { sessions: FrenchSession[]; idMap: Map<string, number> } {
  type Src = { row: FrenchSession; from: 'r' | 'l' }
  const all: Src[] = [
    ...remote.map(row => ({ row, from: 'r' as const })),
    ...local.map(row => ({ row, from: 'l' as const })),
  ]
  const byFp = new Map<string, Src[]>()
  for (const s of all) {
    const fp = fpOmit(s.row, ['id'])
    const arr = byFp.get(fp) ?? []
    arr.push(s)
    byFp.set(fp, arr)
  }
  const canonical: Src[] = []
  for (const [, arr] of byFp) {
    canonical.push(arr.find(x => x.from === 'r') ?? arr[0])
  }
  canonical.sort((a, b) => a.row.started_at.localeCompare(b.row.started_at))
  const idMap = new Map<string, number>()
  let nid = 1
  for (const c of canonical) {
    const newId = nid++
    const fp = fpOmit(c.row, ['id'])
    for (const s of byFp.get(fp) ?? []) {
      idMap.set(`${s.from}:${s.row.id}`, newId)
    }
  }
  const sessions = canonical.map((c, i) => ({ ...c.row, id: i + 1 }))
  return { sessions, idMap }
}

interface FrenchResultRow {
  id: number
  verb: string
  tense: string
  pronoun: string
  correct_answer?: string
  answer_given?: string
  is_correct: boolean
  mode: string
  session_id?: number
  asked_at: string
}

function mergeFrenchResults(
  remote: FrenchResultRow[],
  local: FrenchResultRow[],
  sessionIdMap: Map<string, number>,
): FrenchResultRow[] {
  type Tagged = { row: FrenchResultRow; from: 'r' | 'l' }
  const tagged: Tagged[] = [
    ...remote.map(row => ({ row, from: 'r' as const })),
    ...local.map(row => ({ row, from: 'l' as const })),
  ]
  const seen = new Set<string>()
  const kept: Tagged[] = []
  for (const t of tagged) {
    const fp = fpOmit(t.row, ['id'])
    if (seen.has(fp)) continue
    seen.add(fp)
    kept.push(t)
  }
  kept.sort((a, b) => a.row.asked_at.localeCompare(b.row.asked_at))
  return kept.map((t, i) => {
    const sid = t.row.session_id
    let nextSid: number | undefined
    if (sid != null && Number.isFinite(sid)) {
      const mapped = sessionIdMap.get(`${t.from}:${sid}`)
      if (mapped != null) nextSid = mapped
    }
    return {
      ...t.row,
      id: i + 1,
      session_id: nextSid,
    }
  })
}

function mergeLedgerSpend(remote: CheckLedgerEntry[], local: CheckLedgerEntry[]): CheckLedgerEntry[] {
  const nonEarn = [...remote, ...local].filter(
    (e): e is Exclude<CheckLedgerEntry, { kind: 'earn' }> => e.kind !== 'earn',
  )
  const seen = new Set<string>()
  const kept: CheckLedgerEntry[] = []
  for (const e of nonEarn) {
    const fp = fpOmit(e, ['id'])
    if (seen.has(fp)) continue
    seen.add(fp)
    kept.push(e)
  }
  kept.sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at)
    if (c !== 0) return c
    return a.kind.localeCompare(b.kind)
  })
  return kept.map((e, i) => ({ ...e, id: i + 1 })) as CheckLedgerEntry[]
}

const USER_FILE_RE =
  /^(results|verb-results|tables-results|tables-sessions|french-results|french-sessions|quiz-sessions|check-ledger|check-redemptions)-(\d+)\.json$/

function discoverUserIdsFromDisk(): Set<number> {
  const ids = new Set<number>()
  if (!fs.existsSync(DATA_DIR)) return ids
  for (const name of fs.readdirSync(DATA_DIR)) {
    const m = name.match(USER_FILE_RE)
    if (m) ids.add(Number(m[2]))
  }
  return ids
}

async function main(): Promise<void> {
  loadEnvFiles()
  const token = resolveBlobToken()
  if (!token) {
    console.error('Missing BLOB_READ_WRITE_TOKEN (check .env.local).')
    process.exit(1)
  }

  process.env.BLOB_READ_WRITE_TOKEN = token

  const localUsers = readLocalJson<UserRow[]>('users.json', [])
  const remoteUsers = await blobGetJson<UserRow[]>(token, 'users.json', [])
  const users = mergeUsers(localUsers, remoteUsers)
  const userIds = new Set<number>([...users.map(u => u.id), ...discoverUserIdsFromDisk()])

  console.log('Merging for user ids:', [...userIds].sort((a, b) => a - b).join(', '))

  await blobPutJson(token, 'users.json', users)

  for (const uid of [...userIds].sort((a, b) => a - b)) {
    const suf = `${uid}.json`

    const rResults = await blobGetJson<RowWithAttemptedAt[]>(token, `results-${suf}`, [])
    const lResults = readLocalJson<RowWithAttemptedAt[]>(`results-${suf}`, [])
    const mergedResults = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rResults, lResults, ['id']),
      (a, b) => a.attempted_at.localeCompare(b.attempted_at),
    )
    await blobPutJson(token, `results-${suf}`, mergedResults)

    const rVerb = await blobGetJson<RowWithAttemptedAt[]>(token, `verb-results-${suf}`, [])
    const lVerb = readLocalJson<RowWithAttemptedAt[]>(`verb-results-${suf}`, [])
    const mergedVerb = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rVerb, lVerb, ['id']),
      (a, b) => a.attempted_at.localeCompare(b.attempted_at),
    )
    await blobPutJson(token, `verb-results-${suf}`, mergedVerb)

    const rTbl = await blobGetJson<RowWithAttemptedAt[]>(token, `tables-results-${suf}`, [])
    const lTbl = readLocalJson<RowWithAttemptedAt[]>(`tables-results-${suf}`, [])
    const mergedTbl = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rTbl, lTbl, ['id']),
      (a, b) => a.attempted_at.localeCompare(b.attempted_at),
    )
    await blobPutJson(token, `tables-results-${suf}`, mergedTbl)

    const rTs = await blobGetJson<RowWithCompletedAt[]>(token, `tables-sessions-${suf}`, [])
    const lTs = readLocalJson<RowWithCompletedAt[]>(`tables-sessions-${suf}`, [])
    const mergedTs = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rTs, lTs, ['id']),
      (a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''),
    )
    await blobPutJson(token, `tables-sessions-${suf}`, mergedTs)

    const rFr = await blobGetJson<FrenchResultRow[]>(token, `french-results-${suf}`, [])
    const lFr = readLocalJson<FrenchResultRow[]>(`french-results-${suf}`, [])
    const rFs = await blobGetJson<FrenchSession[]>(token, `french-sessions-${suf}`, [])
    const lFs = readLocalJson<FrenchSession[]>(`french-sessions-${suf}`, [])
    const { sessions: mergedFs, idMap: frenchSessionMap } = mergeFrenchSessions(rFs, lFs)
    const mergedFr = mergeFrenchResults(rFr, lFr, frenchSessionMap)
    await blobPutJson(token, `french-sessions-${suf}`, mergedFs)
    await blobPutJson(token, `french-results-${suf}`, mergedFr)

    const rQuiz = await blobGetJson<RowWithCompletedAt[]>(token, `quiz-sessions-${suf}`, [])
    const lQuiz = readLocalJson<RowWithCompletedAt[]>(`quiz-sessions-${suf}`, [])
    const mergedQuiz = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rQuiz, lQuiz, ['id']),
      (a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''),
    )
    await blobPutJson(token, `quiz-sessions-${suf}`, mergedQuiz)

    const rRed = await blobGetJson<CheckRedemption[]>(token, `check-redemptions-${suf}`, [])
    const lRed = readLocalJson<CheckRedemption[]>(`check-redemptions-${suf}`, [])
    const mergedRed = sortAndRenumberIds(
      mergeRowsDedupeRemoteFirst(rRed, lRed, ['id']),
      (a, b) => a.created_at.localeCompare(b.created_at),
    )
    await blobPutJson(token, `check-redemptions-${suf}`, mergedRed)

    const rLed = await blobGetJson<CheckLedgerEntry[]>(token, `check-ledger-${suf}`, [])
    const lLed = readLocalJson<CheckLedgerEntry[]>(`check-ledger-${suf}`, [])
    const mergedLed = mergeLedgerSpend(rLed, lLed)
    await blobPutJson(token, `check-ledger-${suf}`, mergedLed)

    console.log(`  user ${uid}: wrote merged JSON blobs`)
  }

  const rFv = await blobGetJson<unknown[]>(token, 'french-verbs.json', [])
  const lFv = readLocalJson<unknown[]>('french-verbs.json', [])
  if (lFv.length || rFv.length) {
    const seen = new Set<string>()
    const out: unknown[] = []
    for (const row of [...rFv, ...lFv]) {
      const fp = stableStringify(row)
      if (seen.has(fp)) continue
      seen.add(fp)
      out.push(row)
    }
    await blobPutJson(token, 'french-verbs.json', out)
    console.log(`  french-verbs.json: ${out.length} rows (deduped)`)
  }

  const { mirrorRedemptionsIntoLedger, recomputePracticeEarnLedger } = await import(
    '../lib/checkLedger'
  )
  for (const uid of [...userIds].sort((a, b) => a - b)) {
    await mirrorRedemptionsIntoLedger(uid)
    await recomputePracticeEarnLedger(uid)
    console.log(`  user ${uid}: ledger mirrored + practice earn recomputed`)
  }

  console.log('Done. Local + remote progress merged into Vercel Blob.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
