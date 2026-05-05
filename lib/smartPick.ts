/** Small random jitter so equally-scored items don’t always appear in the same order. */
export function scoreKey(score: number, jitter = 4): number {
  return score + Math.random() * jitter
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type WeightedDrawMeta = {
  step: number
  /** Poids de l’item choisi à cette étape. */
  chosenWeight: number
  /** Somme des poids encore en jeu avant le tirage. */
  sumWeightsRemaining: number
  /** chosenWeight / sumWeightsRemaining — chance de sortir à cette étape si on ne regarde que ce tour. */
  probabilityThisStep: number
  /** Nombre d’items encore dans le sac avant ce tirage. */
  remainingCount: number
}

/**
 * Picks exactly `k` distinct items — higher weight = more likely to be chosen.
 * Identical à l’ancienne version (ordre des questions : shuffle du lot tiré).
 */
export function weightedSampleWithoutReplacement<T>(items: T[], weightOf: (t: T) => number, k: number): T[] {
  const { shuffledResult } = weightedSampleWithoutReplacementTraced(items, weightOf, k, t =>
    String((t as { id?: string | number }).id ?? JSON.stringify(t)),
  )
  return shuffledResult
}

/**
 * Idem tirage pondéré, mais conserve **pourquoi** chaque item a été choisi (étape, poids, probabilité conditionnelle).
 * `getKey` doit être stable et unique par item.
 */
export function weightedSampleWithoutReplacementTraced<T>(
  items: T[],
  weightOf: (t: T) => number,
  k: number,
  getKey: (t: T) => string | number,
): {
  shuffledResult: T[]
  /** Une entrée par item tiré : pourquoi à l’étape `step`. */
  metaByKey: Map<string | number, WeightedDrawMeta>
} {
  const pool = [...items]
  const metaByKey = new Map<string | number, WeightedDrawMeta>()
  const drawOrder: T[] = []
  const nTake = Math.min(k, pool.length)
  for (let step = 0; step < nTake; step++) {
    let total = 0
    const weights = pool.map(t => Math.max(0.0001, weightOf(t)))
    for (const w of weights) total += w
    let r = Math.random() * total
    let pickedIndex = 0
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]!
      if (r <= 0) {
        pickedIndex = i
        break
      }
    }
    const chosen = pool[pickedIndex]!
    const wChosen = weights[pickedIndex]!
    const key = getKey(chosen)
    metaByKey.set(key, {
      step: step + 1,
      chosenWeight: wChosen,
      sumWeightsRemaining: total,
      probabilityThisStep: wChosen / total,
      remainingCount: pool.length,
    })
    drawOrder.push(chosen)
    pool.splice(pickedIndex, 1)
  }
  const shuffledResult = shuffle(drawOrder)
  return { shuffledResult, metaByKey }
}

/** Full pool ordered hardest / stale first, with jitter. */
export function orderByDescendingWeight<T>(items: T[], weightOf: (t: T) => number): T[] {
  return [...items]
    .map(item => ({ item, key: scoreKey(weightOf(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(x => x.item)
}

export function daysSinceMs(lastMs: number, nowMs: number): number {
  if (!Number.isFinite(lastMs)) return 0
  return Math.max(0, (nowMs - lastMs) / 86400000)
}
