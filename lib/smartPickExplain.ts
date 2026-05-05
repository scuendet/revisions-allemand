import type { WeightedDrawMeta } from '@/lib/smartPick'

/** Tri déterministe par poids (pour rang « Tout »), sans jitter — plus lisible que l’ordre live. */
export function rankByDescendingWeight<T>(
  items: T[],
  weightOf: (t: T) => number,
  getKey: (t: T) => string | number,
): Map<string | number, { rank: number; total: number; weight: number }> {
  const scored = items.map(t => ({ t, w: weightOf(t) }))
  scored.sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w
    return String(getKey(a.t)).localeCompare(String(getKey(b.t)))
  })
  const m = new Map<string | number, { rank: number; total: number; weight: number }>()
  scored.forEach((s, i) => {
    m.set(getKey(s.t), { rank: i + 1, total: items.length, weight: s.w })
  })
  return m
}

/** Pourquoi cette question a été retenue au tirage pondéré (session courte, mode intelligent). */
export function frenchExplainWeightedPick(meta: WeightedDrawMeta, totalPicks: number): string[] {
  const pct = (meta.probabilityThisStep * 100).toFixed(1)
  return [
    `Pourquoi elle apparaît dans cet exemple : au tirage sans remise n°${meta.step} sur ${totalPicks}, il restait ${meta.remainingCount} questions possibles dans le pool.`,
    `À cette étape, la somme des poids encore en jeu était ${meta.sumWeightsRemaining.toFixed(1)} ; le poids de cette question était ${meta.chosenWeight.toFixed(1)} → part du hasard pour ce tirage ≈ ${pct}% (plus c’est élevé, plus elle avait de chances d’être pigée à ce moment-là).`,
    `L’ordre affiché dans la série est ensuite mélangé : l’exemple ne montre pas l’ordre exact des tirages, mais le même lot que la vraie session.`,
  ]
}

/** Mode « Tout » / couverture complète : ordre par score, pas de loterie. */
export function frenchExplainOrderedRank(rank: number, total: number, weight: number): string[] {
  return [
    `Pourquoi elle est là : en mode « Tout » (ou session = taille du pool), on ne fait pas de tirage pondéré — on parcourt toutes les questions une fois, dans l’ordre de score (le plus prioritaire d’abord ; petite randomisation pour départager les égalités).`,
    `Rang approximatif après tri par score : ${rank} / ${total} (poids ≈ ${weight.toFixed(1)}).`,
  ]
}

/** Tirage aléatoire sans historique. */
export function frenchExplainRandomPick(poolSize: number): string[] {
  return [
    `Pourquoi elle apparaît : tirage équiprobable parmi ${poolSize} questions du pool — l’historique ne sert pas au choix.`,
  ]
}
