import {
  daysSinceMs,
  orderByDescendingWeight,
  shuffle,
  weightedSampleWithoutReplacement,
} from '@/lib/smartPick'

/** Matches entries in `data/vocab.json`. */
export interface GermanVocabWord {
  id: number
  unit: number
  french: string
  german: string
  unit_title: string
}

export interface VocabResultRow {
  id: number
  vocab_id: number
  mode: string
  correct: number | boolean
  attempted_at: string
}

function isCorrect(value: VocabResultRow['correct']): boolean {
  return value === 1 || value === true
}

export function filterVocabResultsByMode(results: VocabResultRow[], mode?: string): VocabResultRow[] {
  if (!mode || !mode.trim()) return results
  return results.filter(r => r.mode === mode)
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function computeVocabSmartScore(
  history: VocabResultRow[],
  nowMs: number,
): { weight: number; bullets: string[] } {
  const bullets: string[] = []

  if (history.length === 0) {
    bullets.push("Aucun essai pour ce mot dans le mode choisi (flashcards, audio ou frappe).")
    bullets.push("Donnée : aucune ligne results pour ce vocab_id × ce mode.")
    bullets.push("Effet : poids élevé (priorité « découverte »).")
    return { weight: 100, bullets }
  }

  const sorted = [...history].sort(
    (a, b) => Date.parse(b.attempted_at) - Date.parse(a.attempted_at),
  )
  const latest = sorted[0]!
  const lastWrong = !isCorrect(latest.correct)
  let nCorrect = 0
  for (const r of history) {
    if (isCorrect(r.correct)) nCorrect++
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
    `Historique utilisé : ${attempts} essai${attempts > 1 ? 's' : ''} pour ce mot (même mode).`,
  )
  bullets.push(
    `Taux observé : ${nCorrect}/${attempts} justes (${Math.round(acc * 100)} %).`,
  )
  bullets.push(
    lastWrong
      ? `Dernier essai : faux (${fmtWhen(latest.attempted_at)}).`
      : `Dernier essai : juste (${fmtWhen(latest.attempted_at)}).`,
  )
  const staleRounded = stale < 1 ? `${Math.round(stale * 24)} h` : `${stale.toFixed(1)} j`
  bullets.push(`Temps depuis le dernier essai : ${staleRounded}.`)
  if (!lastWrong && stale < 0.35) {
    bullets.push("Réussi très récemment : poids légèrement réduit pour varier.")
  }
  bullets.push(`Score numérique pour le tirage : ≈ ${weight.toFixed(1)}.`)

  return { weight, bullets }
}

function randomPick(filtered: GermanVocabWord[], count: number) {
  return shuffle(filtered).slice(0, count)
}

export function pickGermanVocabQuestions(params: {
  filtered: GermanVocabWord[]
  count: number | 'all'
  smart: boolean
  userId: number | null
  mode?: string
  results: VocabResultRow[]
}): GermanVocabWord[] {
  const { filtered, count, smart, userId, mode, results } = params
  const requestedCount =
    count === 'all'
      ? filtered.length
      : typeof count === 'number' && Number.isFinite(count)
        ? count
        : 10

  if (!smart || !userId) {
    return randomPick(filtered, Math.min(requestedCount, filtered.length))
  }

  const relevant = filterVocabResultsByMode(results, mode)
  const historyByVocab = new Map<number, VocabResultRow[]>()
  for (const r of relevant) {
    const list = historyByVocab.get(r.vocab_id) ?? []
    list.push(r)
    historyByVocab.set(r.vocab_id, list)
  }

  const nowMs = Date.now()
  const weightItem = (item: GermanVocabWord) =>
    computeVocabSmartScore(historyByVocab.get(item.id) ?? [], nowMs).weight

  if (requestedCount >= filtered.length) {
    return orderByDescendingWeight(filtered, weightItem)
  }

  return weightedSampleWithoutReplacement(filtered, weightItem, requestedCount)
}
