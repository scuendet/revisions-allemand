import {
  daysSinceMs,
  orderByDescendingWeight,
  weightedSampleWithoutReplacement,
  shuffle,
} from '@/lib/smartPick'

export interface TableQuestion {
  id: string
  left: number
  right: number
  answer: number
}

export interface TableResultRow {
  question_key: string
  left: number
  right: number
  mode: string
  correct: number
  attempted_at: string
}

export type TablesMode = 'flashcard' | 'audio' | 'typing'

const DEFAULT_TABLES = Array.from({ length: 11 }, (_, i) => i + 2)

export function normalizeTablesInput(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_TABLES]
  const set = new Set<number>()
  for (const v of raw) {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (Number.isInteger(n) && n >= 2 && n <= 12) set.add(n)
  }
  return set.size > 0 ? [...set].sort((a, b) => a - b) : [...DEFAULT_TABLES]
}

export function buildTablePool(tables: number[]): TableQuestion[] {
  const pool: TableQuestion[] = []
  for (const left of tables) {
    for (let right = 2; right <= 12; right++) {
      pool.push({
        id: `${left}x${right}`,
        left,
        right,
        answer: left * right,
      })
    }
  }
  return pool
}

function isCorrectRow(r: TableResultRow): boolean {
  return r.correct === 1
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/** Same numeric weight as production picker; paired with human-readable data points. */
export function computeTableSmartScore(
  history: TableResultRow[],
  nowMs: number,
): { weight: number; bullets: string[] } {
  const bullets: string[] = []

  if (history.length === 0) {
    bullets.push("Aucun essai enregistré pour cette multiplication dans le mode actif.")
    bullets.push("Donnée utilisée : absence de lignes dans tables-results pour cette clé × ce mode.")
    bullets.push("Effet : poids élevé (priorité « découverte »).")
    return { weight: 100, bullets }
  }

  const sorted = [...history].sort(
    (a, b) => Date.parse(b.attempted_at) - Date.parse(a.attempted_at),
  )
  const latest = sorted[0]!
  const lastWrong = !isCorrectRow(latest)
  let nCorrect = 0
  for (const r of history) {
    if (isCorrectRow(r)) nCorrect++
  }
  const acc = nCorrect / history.length
  const attempts = history.length
  const lastMs = Date.parse(latest.attempted_at) || nowMs
  const stale = daysSinceMs(lastMs, nowMs)

  let w = 10
  w += (1 - acc) * 55
  if (lastWrong) w += 48
  w += Math.min(21, stale) * 2.2
  if (!lastWrong && stale < 0.35) w -= 18
  const weight = Math.max(0.5, w)

  bullets.push(
    `Historique utilisé : ${attempts} essai${attempts > 1 ? 's' : ''} sur cette opération (même mode).`,
  )
  bullets.push(
    `Taux observé : ${nCorrect}/${attempts} justes (${Math.round(acc * 100)} %) — pénalise les multiplications instables.`,
  )
  bullets.push(
    lastWrong
      ? `Dernier essai : faux (${fmtWhen(latest.attempted_at)}). Donnée : champ « correct » = 0.`
      : `Dernier essai : juste (${fmtWhen(latest.attempted_at)}).`,
  )
  const staleRounded = stale < 1 ? `${Math.round(stale * 24)} h` : `${stale.toFixed(1)} j`
  bullets.push(`Écart depuis le dernier essai : ${staleRounded} (renforce la priorité quand c’est ancien).`)
  if (!lastWrong && stale < 0.35) {
    bullets.push("Réussi très récemment : le score est légèrement abaissé pour varier les questions.")
  }
  bullets.push(`Score numérique interne utilisé pour le tirage : ≈ ${weight.toFixed(1)} (plus élevé = tiré plus souvent).`)

  return { weight, bullets }
}

export function filterTableResultsByMode(results: TableResultRow[], mode?: string): TableResultRow[] {
  if (!mode || !['flashcard', 'audio', 'typing'].includes(mode)) return results
  return results.filter(r => r.mode === mode)
}

function pickQuestionsRandom(pool: TableQuestion[], count: number): TableQuestion[] {
  if (!pool.length || count <= 0) return []
  const shuffled = shuffle(pool)
  if (pool.length >= count) {
    return shuffled.slice(0, count)
  }
  const out: TableQuestion[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]!)
  }
  return shuffle(out)
}

export function pickTableQuestions(params: {
  pool: TableQuestion[]
  count: number
  smart: boolean
  userId: number | null
  mode?: TablesMode
  results: TableResultRow[]
}): TableQuestion[] {
  const { pool, count, smart, userId, mode, results } = params
  const c = Math.min(Math.max(count, 1), pool.length === 0 ? 1 : pool.length)
  if (!smart || !userId) {
    return pickQuestionsRandom(pool, c)
  }

  const scoped = filterTableResultsByMode(results, mode)
  const byKey = new Map<string, TableResultRow[]>()
  for (const r of scoped) {
    const key = r.question_key || `${r.left}x${r.right}`
    const arr = byKey.get(key) ?? []
    arr.push(r)
    byKey.set(key, arr)
  }

  const nowMs = Date.now()
  const weightQ = (q: TableQuestion) =>
    computeTableSmartScore(byKey.get(q.id) ?? [], nowMs).weight

  if (c >= pool.length) {
    return orderByDescendingWeight(pool, weightQ)
  }
  return weightedSampleWithoutReplacement(pool, weightQ, c)
}
