import {
  POINTS_PER_CHECK,
  readRedemptions,
  type CheckRedemption,
  type FrenchSession,
  type VerbPracticeResult,
  type TablePracticeResult,
  type VocabPracticeResult,
} from '@/lib/checks'
import { MATH_CORRECTS_PER_POINT, MATH_PERFECT_SESSION_BONUS } from '@/lib/checksConfig'
import { nextId, readJson, writeJson } from '@/lib/store'

/** Full row persisted in blob / data — session bonus keyed with id for ordering. */
interface TableSessionStored {
  id: number
  perfect_series_bonus: number
  completed_at: string
}

/** Append-only bookkeeping for chèques (credits practice, debits family). */
export type CheckLedgerEntry =
  | {
      id: number
      kind: 'earn'
      created_at: string
      checks: number
      headline: string
      detail?: string
    }
  | {
      id: number
      kind: 'spend'
      created_at: string
      checks: number
      note: string
      redemption_id: number
    }
  | {
      id: number
      kind: 'spend_undo'
      created_at: string
      checks: number
      redemption_id: number
      note?: string
    }

export function checkLedgerFilename(userId: number): string {
  return `check-ledger-${userId}.json`
}

export async function readCheckLedger(userId: number): Promise<CheckLedgerEntry[]> {
  return readJson<CheckLedgerEntry[]>(checkLedgerFilename(userId), [])
}

async function saveCheckLedger(userId: number, entries: CheckLedgerEntry[]): Promise<void> {
  await writeJson(checkLedgerFilename(userId), entries)
}

function ledgerMaxId(entries: CheckLedgerEntry[]): number {
  return entries.length ? Math.max(...entries.map(e => e.id)) : 0
}

/** Adds missing spend lines cloned from registre famille (anciennes données). */
export async function mirrorRedemptionsIntoLedger(userId: number): Promise<void> {
  const ledger = await readCheckLedger(userId)
  const redemptions = await readRedemptions(userId)
  const known = new Set(
    ledger.filter((e): e is Extract<CheckLedgerEntry, { kind: 'spend' }> => e.kind === 'spend').map(e => e.redemption_id),
  )

  const additions: CheckLedgerEntry[] = []
  let nid = ledgerMaxId(ledger) + 1
  for (const r of redemptions) {
    if (known.has(r.id)) continue
    additions.push({
      id: nid++,
      kind: 'spend',
      created_at: r.created_at,
      checks: r.checks_used,
      note: r.note,
      redemption_id: r.id,
    })
  }
  if (additions.length === 0) return
  await saveCheckLedger(userId, [...ledger, ...additions])
}

type TimelineEv =
  | { t: string; sort: number; vocabCorrect: boolean; subject?: 'german' | 'english' }
  | { t: string; sort: number; verbPts: number }
  | { t: string; sort: number; tableCorrect: boolean }
  | { t: string; sort: number; bonus: number }
  | { t: string; sort: number; frenchSessionPts: number; frenchDetail: string }

/**
 * Recalcule toutes les lignes « earn » depuis les fichiers résultats (source de vérité).
 * Idempotent ; conserve les lignes dépenses / annulations famille.
 */
export async function recomputePracticeEarnLedger(userId: number): Promise<void> {
  const vocabResults = await readJson<VocabPracticeResult[]>(`results-${userId}.json`, [])
  const englishResults = await readJson<VocabPracticeResult[]>(`english-results-${userId}.json`, [])
  const verbResults = await readJson<VerbPracticeResult[]>(`verb-results-${userId}.json`, [])
  const tableResults = await readJson<TablePracticeResult[]>(`tables-results-${userId}.json`, [])
  const sessions = await readJson<TableSessionStored[]>(`tables-sessions-${userId}.json`, [])
  const frenchSessions = await readJson<FrenchSession[]>(`french-sessions-${userId}.json`, [])

  const ev: TimelineEv[] = [
    ...vocabResults.map(
      r =>
        ({
          t: r.attempted_at,
          sort: 0,
          vocabCorrect: r.correct === 1,
        }) satisfies TimelineEv,
    ),
    ...englishResults.map(r => ({
      t: r.attempted_at,
      sort: 0,
      vocabCorrect: r.correct === 1,
      subject: 'english' as const,
    })),
    ...verbResults.map(
      r =>
        ({
          t: r.attempted_at,
          sort: 1,
          verbPts: Math.max(0, r.correct_count - 3),
        }) satisfies TimelineEv,
    ),
    ...tableResults.map(
      r =>
        ({
          t: r.attempted_at,
          sort: 2,
          tableCorrect: r.correct === 1,
        }) satisfies TimelineEv,
    ),
    ...sessions.flatMap(s => {
      const raw = s.perfect_series_bonus
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return []
      const bonus = Math.min(Math.floor(raw), MATH_PERFECT_SESSION_BONUS)
      if (bonus <= 0) return []
      return [{ t: s.completed_at, sort: 3, bonus } satisfies TimelineEv]
    }),
    ...frenchSessions.flatMap(s => {
      const pts = typeof s.points === 'number' && Number.isFinite(s.points) ? s.points : 0
      if (pts <= 0) return []
      const mult = s.point_multiplier || 1
      let detail = `${pts} pts`
      if (s.difficulty === 'hard') detail += ` (difficile ×${mult})`
      else if (s.difficulty === 'medium') detail += ` (moyen ×${mult})`
      return [{ t: s.started_at, sort: 4, frenchSessionPts: pts, frenchDetail: detail } satisfies TimelineEv]
    }),
  ]

  ev.sort((a, b) => {
    const c = a.t.localeCompare(b.t)
    if (c !== 0) return c
    return a.sort - b.sort
  })

  let germanVocabPts = 0
  let germanVerbPts = 0
  let tableCorrectCount = 0
  let bonusPts = 0
  let frenchTotalPts = 0

  function mathPoints(): number {
    return Math.floor(tableCorrectCount / MATH_CORRECTS_PER_POINT) + bonusPts
  }

  function totalPts(): number {
    return germanVocabPts + germanVerbPts + mathPoints() + frenchTotalPts
  }

  const earns: Omit<Extract<CheckLedgerEntry, { kind: 'earn' }>, 'id'>[] = []
  let lastEarnedChecks = 0

  for (const e of ev) {
    let headline = ''
    let detail = ''
    if ('vocabCorrect' in e) {
      if (e.vocabCorrect) germanVocabPts += 1
      headline = e.subject === 'english' ? 'Anglais — vocabulaire' : 'Allemand — vocabulaire'
      detail = e.vocabCorrect ? 'Bonne réponse (+1 pt)' : ''
    } else if ('verbPts' in e) {
      const p = Number.isFinite(e.verbPts) ? Math.max(0, Math.floor(e.verbPts)) : 0
      germanVerbPts += p
      headline = 'Allemand — conjugaison'
      detail = `${p} point${p !== 1 ? 's' : ''} après la série`
    } else if ('tableCorrect' in e) {
      if (e.tableCorrect) tableCorrectCount += 1
      headline = 'Tables de multiplication'
      detail = e.tableCorrect
        ? `Bonne réponse (+1 bonne réponse → comptabilité maths par blocs de ${MATH_CORRECTS_PER_POINT})`
        : 'Réponse incorrecte'
    } else if ('frenchSessionPts' in e) {
      frenchTotalPts += e.frenchSessionPts
      headline = 'Français — conjugaison'
      detail = e.frenchDetail
    } else {
      bonusPts += Math.max(0, Math.floor(e.bonus))
      headline = 'Bonus série tables parfaite'
      detail = `+${e.bonus} pts (conversion chèques : ${POINTS_PER_CHECK} pts = 1 chèque)`
    }

    const afterPts = totalPts()
    const earnedChecks = Math.floor(afterPts / POINTS_PER_CHECK)
    const deltaChecks = earnedChecks - lastEarnedChecks
    if (deltaChecks > 0 && headline) {
      earns.push({
        kind: 'earn',
        created_at: e.t,
        checks: deltaChecks,
        headline,
        detail:
          deltaChecks === 1
            ? detail || undefined
            : `${deltaChecks} chèques (seuils d’affilée) · ${detail}`.trim(),
      })
      lastEarnedChecks = earnedChecks
    }
  }

  const ledgerWas = await readCheckLedger(userId)
  const withoutEarn = ledgerWas.filter(e => e.kind !== 'earn')
  let nextIdAssign = ledgerMaxId(withoutEarn) + 1
  const earnsWithIds: Extract<CheckLedgerEntry, { kind: 'earn' }>[] = earns.map(e => ({
    ...e,
    id: nextIdAssign++,
  }))

  const merged = [...withoutEarn, ...earnsWithIds].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at)
    if (c !== 0) return c
    const order = (k: CheckLedgerEntry['kind']) =>
      ({ earn: 0, spend_undo: 1, spend: 2 } satisfies Record<CheckLedgerEntry['kind'], number>)[k]
    return order(a.kind) - order(b.kind)
  })
  await saveCheckLedger(userId, merged)
}

export async function appendSpendLedger(userId: number, redemption: CheckRedemption): Promise<void> {
  const ledger = await readCheckLedger(userId)
  const entry: Extract<CheckLedgerEntry, { kind: 'spend' }> = {
    id: nextId(ledger),
    kind: 'spend',
    created_at: redemption.created_at,
    checks: redemption.checks_used,
    note: redemption.note,
    redemption_id: redemption.id,
  }
  await saveCheckLedger(userId, [...ledger, entry])
}

export async function appendSpendUndoLedger(userId: number, redemptionId: number, checks: number): Promise<void> {
  const ledger = await readCheckLedger(userId)
  const entry: Extract<CheckLedgerEntry, { kind: 'spend_undo' }> = {
    id: nextId(ledger),
    kind: 'spend_undo',
    created_at: new Date().toISOString(),
    checks,
    redemption_id: redemptionId,
    note: 'Annulation dans le registre (les chèques redeviennent disponibles).',
  }
  await saveCheckLedger(userId, [...ledger, entry])
}

/** Ordonné du plus récent au plus ancien pour l’interface. */
export async function sortedLedgerDesc(userId: number): Promise<CheckLedgerEntry[]> {
  await mirrorRedemptionsIntoLedger(userId)
  await recomputePracticeEarnLedger(userId)

  const raw = await readCheckLedger(userId)
  const sorted = [...raw].sort((a, b) => {
    const c = b.created_at.localeCompare(a.created_at)
    if (c !== 0) return c
    return b.id - a.id
  })
  return sorted
}
