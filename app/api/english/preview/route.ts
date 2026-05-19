import { NextRequest, NextResponse } from 'next/server'
import englishVocab from '@/data/english-vocab.json'
import { readJson } from '@/lib/store'
import { orderByDescendingWeight, weightedSampleWithoutReplacementTraced } from '@/lib/smartPick'
import {
  frenchExplainOrderedRank,
  frenchExplainRandomPick,
  frenchExplainWeightedPick,
  rankByDescendingWeight,
} from '@/lib/smartPickExplain'
import {
  computeEnglishSmartScore,
  filterEnglishResultsByMode,
  pickEnglishVocabQuestions,
  type EnglishVocabWord,
  type EnglishResultRow,
} from '@/lib/englishVocabSelection'

const MODE_LABEL: Record<string, string> = {
  flashcard: 'Flashcards',
  audio: 'Audio',
  typing: 'Frappe',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const units = body.units
  if (!Array.isArray(units) || units.length === 0) {
    return NextResponse.json({ error: 'Units required' }, { status: 400 })
  }

  const mode = typeof body.mode === 'string' ? body.mode : undefined
  if (!mode || !mode.trim()) {
    return NextResponse.json(
      { error: 'Choisir un mode (flashcard, audio ou frappe) pour un aperçu aligné sur la session.' },
      { status: 400 },
    )
  }

  const filtered = (englishVocab as EnglishVocabWord[]).filter(v => units.includes(v.unit))

  const countArg: number | 'all' =
    body.count === 'all'
      ? 'all'
      : typeof body.count === 'number' && Number.isFinite(body.count)
        ? body.count
        : 10

  const uid = Number(body.user_id)
  const hasUser = Number.isInteger(uid)
  const smartRaw = body.smart
  const smart =
    !hasUser ? false : smartRaw === false || smartRaw === 0 || smartRaw === '0' ? false : true

  const results = hasUser ? await readJson<EnglishResultRow[]>(`english-results-${uid}.json`, []) : []
  const scoped = filterEnglishResultsByMode(results, mode)
  const historyByVocab = new Map<number, EnglishResultRow[]>()
  for (const r of scoped) {
    const list = historyByVocab.get(r.vocab_id) ?? []
    list.push(r)
    historyByVocab.set(r.vocab_id, list)
  }

  const nowMs = Date.now()

  const weightW = (w: EnglishVocabWord) =>
    computeEnglishSmartScore(historyByVocab.get(w.id) ?? [], nowMs).weight

  const annotate = (w: EnglishVocabWord) => {
    const h = historyByVocab.get(w.id) ?? []
    const { weight, bullets } = computeEnglishSmartScore(h, nowMs)
    return {
      id: w.id,
      unit: w.unit,
      unit_title: w.unit_title,
      french: w.french,
      english: w.english,
      weight,
      bullets,
    }
  }

  const sessionSize = countArg === 'all' ? filtered.length : Math.min(countArg, filtered.length)

  let topRanked: ReturnType<typeof annotate>[] = []
  if (smart && hasUser && filtered.length > 0) {
    const scored = filtered.map(w => annotate(w))
    scored.sort((a, b) => b.weight - a.weight)
    topRanked = scored.slice(0, 15).map((row, idx) => ({
      ...row,
      bullets: [
        `Ici car il est #${idx + 1} au classement par score sur ${filtered.length} mots (les plus hauts poids d'abord).`,
        ...row.bullets,
      ],
    }))
  }

  const randomDetail = (w: EnglishVocabWord) => [
    `Exemple : « ${w.french} » → ${w.english}`,
  ]

  type Ex = Omit<ReturnType<typeof annotate>, 'weight'> & {
    weight: number | null
    whyPicked?: string[]
  }
  let exampleDraw: Ex[]

  if (!smart || !hasUser) {
    const exampleDrawRaw = pickEnglishVocabQuestions({
      filtered,
      count: countArg,
      smart: false,
      userId: null,
      mode,
      results,
    })
    exampleDraw = exampleDrawRaw.map(w => {
      const base = annotate(w)
      return {
        ...base,
        weight: null,
        whyPicked: [...frenchExplainRandomPick(filtered.length), ...randomDetail(w)],
        bullets: base.bullets,
      }
    })
  } else if (countArg === 'all' || sessionSize >= filtered.length) {
    const ordered = orderByDescendingWeight(filtered, weightW)
    const rankMap = rankByDescendingWeight(filtered, weightW, w => w.id)
    exampleDraw = ordered.map(w => {
      const base = annotate(w)
      const r = rankMap.get(w.id)!
      return {
        ...base,
        whyPicked: frenchExplainOrderedRank(r.rank, r.total, r.weight),
        bullets: base.bullets,
      }
    })
  } else {
    const { shuffledResult, metaByKey } = weightedSampleWithoutReplacementTraced(
      filtered,
      weightW,
      sessionSize,
      w => w.id,
    )
    exampleDraw = shuffledResult.map(w => {
      const base = annotate(w)
      const meta = metaByKey.get(w.id)
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
    poolSize: filtered.length,
    sessionSize,
    modeFilter: MODE_LABEL[mode] ?? mode,
    topRanked,
    exampleDraw,
    note:
      smart && hasUser
        ? '« Pourquoi dans cette série » : tour court = tirage pondéré (étape, poids, %). « Tout » ou série = pool complet trié par score, sans loterie.'
        : "Mode aléatoire : l'historique ne sert pas au tri pour cette série.",
  })
}
