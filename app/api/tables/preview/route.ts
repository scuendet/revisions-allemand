import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import { orderByDescendingWeight, weightedSampleWithoutReplacementTraced } from '@/lib/smartPick'
import {
  frenchExplainOrderedRank,
  frenchExplainRandomPick,
  frenchExplainWeightedPick,
  rankByDescendingWeight,
} from '@/lib/smartPickExplain'
import {
  buildTablePool,
  normalizeTablesInput,
  computeTableSmartScore,
  filterTableResultsByMode,
  pickTableQuestions,
  type TableQuestion,
  type TableResultRow,
} from '@/lib/tablesSelection'

const MODE_LABEL: Record<string, string> = {
  flashcard: 'Flashcards',
  audio: 'Audio',
  typing: 'Frappe',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const tables = normalizeTablesInput(body.tables)
  const pool = buildTablePool(tables)

  const requestedCount = body.count === 'all'
    ? pool.length
    : Number.isInteger(body.count)
      ? body.count
      : 10
  const sessionSize = Math.min(Math.max(requestedCount, 1), pool.length === 0 ? 1 : pool.length)

  const uid = Number(body.user_id)
  const hasUser = Number.isInteger(uid)
  const smartRaw = body.smart
  const smart =
    !hasUser ? false : smartRaw === false || smartRaw === 0 || smartRaw === '0' ? false : true

  const mode = typeof body.mode === 'string' ? body.mode : undefined
  const results = hasUser ? await readJson<TableResultRow[]>(`tables-results-${uid}.json`, []) : []
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

  const annotate = (q: TableQuestion) => {
    const h = byKey.get(q.id) ?? []
    const { weight, bullets } = computeTableSmartScore(h, nowMs)
    return {
      ...q,
      weight,
      bullets,
    }
  }

  let topRanked: ReturnType<typeof annotate>[] = []
  if (smart && hasUser && pool.length > 0) {
    const scored = pool.map(q => annotate(q))
    scored.sort((a, b) => b.weight - a.weight)
    topRanked = scored.slice(0, 15).map((row, idx) => ({
      ...row,
      bullets: [
        `Ici car elle est #${idx + 1} au classement par score sur ${pool.length} opérations (les plus hauts poids d’abord).`,
        ...row.bullets,
      ],
    }))
  }

  const randomDetail = (q: TableQuestion) => [
    `Exemple : ${q.left} × ${q.right} = ${q.answer}.`,
  ]

  /** Exemple de série : `whyPicked` = mécanisme, `bullets` = données du poids */
  type Ex = Omit<ReturnType<typeof annotate>, 'weight'> & {
    weight: number | null
    whyPicked?: string[]
  }
  let exampleDraw: Ex[]

  if (!smart || !hasUser) {
    const exampleDrawRaw = pickTableQuestions({
      pool,
      count: sessionSize,
      smart: false,
      userId: null,
      mode,
      results,
    })
    exampleDraw = exampleDrawRaw.map(q => {
      const base = annotate(q)
      return {
        ...base,
        weight: null,
        whyPicked: [...frenchExplainRandomPick(pool.length), ...randomDetail(q)],
        bullets: base.bullets,
      }
    })
  } else if (sessionSize >= pool.length) {
    const ordered = orderByDescendingWeight(pool, weightQ)
    const rankMap = rankByDescendingWeight(pool, weightQ, q => q.id)
    exampleDraw = ordered.map(q => {
      const base = annotate(q)
      const r = rankMap.get(q.id)!
      return {
        ...base,
        whyPicked: frenchExplainOrderedRank(r.rank, r.total, r.weight),
        bullets: base.bullets,
      }
    })
  } else {
    const { shuffledResult, metaByKey } = weightedSampleWithoutReplacementTraced(
      pool,
      weightQ,
      sessionSize,
      q => q.id,
    )
    exampleDraw = shuffledResult.map(q => {
      const base = annotate(q)
      const meta = metaByKey.get(q.id)
      const pickWhy = meta ? frenchExplainWeightedPick(meta, sessionSize) : []
      return {
        ...base,
        whyPicked: pickWhy,
        bullets: base.bullets,
      }
    })
  }

  return NextResponse.json({
    smart,
    hasUser,
    poolSize: pool.length,
    sessionSize,
    modeFilter: mode && MODE_LABEL[mode] ? MODE_LABEL[mode] : mode ?? 'tous modes confondus',
    topRanked,
    exampleDraw,
    note:
      smart && hasUser
        ? '« Pourquoi dans cette série » : pour un tour court, c’est le tirage pondéré (étape, poids, % du tour). Pour « Tout », c’est le rang après tri par score — pas de loterie.'
        : 'Mode aléatoire : chaque opération a la même probabilité dans ta sélection ; l’historique ne sert pas au tri.',
  })
}
