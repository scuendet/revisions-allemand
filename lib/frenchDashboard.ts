export interface FrenchQuestionRow {
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
}

export interface FrenchResultRow {
  id: number
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
  answer_given?: string
  is_correct: boolean
  mode: string
  session_id?: number
  asked_at: string
}

export interface FrenchSessionRow {
  id: number
  started_at: string
  ended_at?: string
  mode: string
  points: number
  point_multiplier?: number
  difficulty?: string
  answers_summary?: { total: number; mistakes: number; score: number }
}

function qKey(q: { verb: string; tense: string; pronoun: string }) {
  return `${q.verb}|${q.tense}|${q.pronoun}`
}

export interface VerbTenseCellForm {
  questionId: string
  pronoun: string
  attempts: number
  correct: number
  status: 'correct' | 'incorrect' | 'unanswered'
}

export interface VerbTenseCell {
  verbIndex: number
  tenseIndex: number
  attempts: number
  correct: number
  accuracy: number
  forms: VerbTenseCellForm[]
}

export interface ProgressRow {
  key: string
  attempts: number
  correct: number
  accuracy: number
}

export interface DayStat {
  date: string
  correct: number
  incorrect: number
}

export interface WeekStat {
  weekStart: string
  correct: number
  incorrect: number
}

export interface SessionListItem {
  id: number
  started_at: string
  ended_at?: string
  mode: string
  points: number
  difficulty?: string
  answers_summary?: { total: number; mistakes: number; score: number }
  results: Array<{
    verb: string
    tense: string
    pronoun: string
    givenAnswer: string
    expectedAnswer: string
    isCorrect: boolean
    askedAt: string
  }>
}

export interface FrenchDashboardPayload {
  verbs: string[]
  tenses: string[]
  verbTenseData: VerbTenseCell[]
  byVerb: ProgressRow[]
  byTense: ProgressRow[]
  totalPoints: number
  totalAttempts: number
  totalCorrect: number
  overallAccuracy: number
  sessionsCompleted: number
  dailyStats: DayStat[]
  weeklyStats: WeekStat[]
  recentSessions: SessionListItem[]
}

export function buildFrenchDashboardPayload(
  catalog: FrenchQuestionRow[],
  results: FrenchResultRow[],
  sessions: FrenchSessionRow[],
): FrenchDashboardPayload {
  const verbs = [...new Set(catalog.map(q => q.verb))].sort((a, b) => a.localeCompare(b))
  const tenses = [...new Set(catalog.map(q => q.tense))].sort((a, b) => a.localeCompare(b))

  const grouped = new Map<string, { attempts: number; correct: number }>()
  const questionStats = new Map<string, { attempts: number; correct: number }>()
  const latestByQuestion = new Map<string, { askedAt: string; isCorrect: boolean }>()

  for (const r of results) {
    const gk = `${r.verb}|${r.tense}`
    const g = grouped.get(gk) || { attempts: 0, correct: 0 }
    g.attempts++
    if (r.is_correct) g.correct++
    grouped.set(gk, g)

    const qid = qKey(r)
    const qs = questionStats.get(qid) || { attempts: 0, correct: 0 }
    qs.attempts++
    if (r.is_correct) qs.correct++
    questionStats.set(qid, qs)

    const prev = latestByQuestion.get(qid)
    if (!prev || r.asked_at > prev.askedAt) {
      latestByQuestion.set(qid, { askedAt: r.asked_at, isCorrect: r.is_correct })
    }
  }

  const verbTenseData: VerbTenseCell[] = []
  for (let vi = 0; vi < verbs.length; vi++) {
    for (let ti = 0; ti < tenses.length; ti++) {
      const verb = verbs[vi]
      const tense = tenses[ti]
      const stats = grouped.get(`${verb}|${tense}`)
      if (!stats || stats.attempts === 0) continue

      const forms = catalog
        .filter(q => q.verb === verb && q.tense === tense)
        .map(q => {
          const qid = qKey(q)
          const qStats = questionStats.get(qid) || { attempts: 0, correct: 0 }
          const latest = latestByQuestion.get(qid)
          const status: VerbTenseCellForm['status'] = !latest
            ? 'unanswered'
            : latest.isCorrect
              ? 'correct'
              : 'incorrect'
          return {
            questionId: qid,
            pronoun: q.pronoun,
            attempts: qStats.attempts,
            correct: qStats.correct,
            status,
          }
        })

      verbTenseData.push({
        verbIndex: vi,
        tenseIndex: ti,
        attempts: stats.attempts,
        correct: stats.correct,
        accuracy: stats.correct / stats.attempts,
        forms,
      })
    }
  }

  const byVerbMap = new Map<string, { attempts: number; correct: number }>()
  const byTenseMap = new Map<string, { attempts: number; correct: number }>()
  for (const r of results) {
    const vb = byVerbMap.get(r.verb) || { attempts: 0, correct: 0 }
    vb.attempts++
    if (r.is_correct) vb.correct++
    byVerbMap.set(r.verb, vb)

    const tn = byTenseMap.get(r.tense) || { attempts: 0, correct: 0 }
    tn.attempts++
    if (r.is_correct) tn.correct++
    byTenseMap.set(r.tense, tn)
  }

  const toRows = (m: Map<string, { attempts: number; correct: number }>): ProgressRow[] =>
    [...m.entries()]
      .map(([key, v]) => ({
        key,
        attempts: v.attempts,
        correct: v.correct,
        accuracy: v.attempts > 0 ? v.correct / v.attempts : 0,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))

  const totalAttempts = results.length
  const totalCorrect = results.filter(r => r.is_correct).length
  const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0

  const totalPoints = sessions.reduce(
    (s, x) => s + (typeof x.points === 'number' && Number.isFinite(x.points) ? x.points : 0),
    0,
  )
  const sessionsCompleted = sessions.filter(s => s.ended_at || s.answers_summary).length

  const dayMap = new Map<string, { correct: number; incorrect: number }>()
  for (const r of results) {
    const d = r.asked_at.slice(0, 10)
    const cur = dayMap.get(d) || { correct: 0, incorrect: 0 }
    if (r.is_correct) cur.correct++
    else cur.incorrect++
    dayMap.set(d, cur)
  }
  const dailyStats: DayStat[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, correct: v.correct, incorrect: v.incorrect }))

  function weekMonday(d: Date): string {
    const x = new Date(d)
    const day = x.getUTCDay()
    const diff = (day + 6) % 7
    x.setUTCDate(x.getUTCDate() - diff)
    x.setUTCHours(0, 0, 0, 0)
    return x.toISOString().slice(0, 10)
  }

  const weekMap = new Map<string, { correct: number; incorrect: number }>()
  for (const r of results) {
    const wk = weekMonday(new Date(r.asked_at))
    const cur = weekMap.get(wk) || { correct: 0, incorrect: 0 }
    if (r.is_correct) cur.correct++
    else cur.incorrect++
    weekMap.set(wk, cur)
  }
  const weeklyStats: WeekStat[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, v]) => ({ weekStart, correct: v.correct, incorrect: v.incorrect }))

  const sortedSessions = [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at))
  const recent = sortedSessions.slice(0, 10)
  const recentSessions: SessionListItem[] = recent.map(s => ({
    id: s.id,
    started_at: s.started_at,
    ended_at: s.ended_at,
    mode: s.mode,
    points: s.points,
    difficulty: s.difficulty,
    answers_summary: s.answers_summary,
    results: results
      .filter(r => r.session_id === s.id)
      .map(r => ({
        verb: r.verb,
        tense: r.tense,
        pronoun: r.pronoun,
        givenAnswer: r.answer_given ?? '',
        expectedAnswer: r.correct_answer,
        isCorrect: r.is_correct,
        askedAt: r.asked_at,
      })),
  }))

  return {
    verbs,
    tenses,
    verbTenseData,
    byVerb: toRows(byVerbMap),
    byTense: toRows(byTenseMap),
    totalPoints,
    totalAttempts,
    totalCorrect,
    overallAccuracy,
    sessionsCompleted,
    dailyStats,
    weeklyStats,
    recentSessions,
  }
}
