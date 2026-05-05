'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface WordStat {
  total_attempts: number
  correct_attempts: number
  last_attempted: string | null
}

interface VerbStat {
  total_attempts: number
  avg_correct: number | null
  last_attempted: string | null
}

interface MathProgress {
  summary: {
    total_attempts: number
    total_correct: number
    sessions: number
  }
  by_table: Array<{
    attempts: number
    correct: number
    last_attempted: string | null
  }>
}

interface FrenchDash {
  totalAttempts: number
  totalCorrect: number
  overallAccuracy: number
  sessionsCompleted: number
  dailyStats: Array<{ date: string }>
  recentSessions: Array<{ started_at: string; ended_at?: string }>
}

const SUBJECT_DEFS = [
  {
    id: 'german' as const,
    flag: '🇩🇪',
    title: 'Allemand',
    subtitle: 'Vocabulaire & conjugaison (DE)',
    color: 'from-blue-600 to-blue-800',
    border: 'border-blue-200',
    accent: 'text-blue-700',
    bar: 'bg-blue-500',
    practiceHref: (uid: string) => `/${uid}/german`,
  },
  {
    id: 'math' as const,
    flag: '✖️',
    title: 'Maths',
    subtitle: 'Tables de multiplication',
    color: 'from-violet-600 to-violet-800',
    border: 'border-violet-200',
    accent: 'text-violet-700',
    bar: 'bg-violet-500',
    practiceHref: (uid: string) => `/${uid}/math`,
  },
  {
    id: 'french' as const,
    flag: '🇫🇷',
    title: 'Français',
    subtitle: 'Conjugaison des verbes',
    color: 'from-rose-500 to-rose-700',
    border: 'border-rose-200',
    accent: 'text-rose-700',
    bar: 'bg-rose-500',
    practiceHref: (uid: string) => `/${uid}/french`,
  },
]

function maxIso(dates: (string | null | undefined)[]): string | null {
  const cleaned = dates.filter((d): d is string => !!d && d.length > 0)
  if (cleaned.length === 0) return null
  return cleaned.reduce((a, b) => (a > b ? a : b))
}

function lastFrenchIso(dash: FrenchDash | null): string | null {
  if (!dash) return null
  const fromSessions = dash.recentSessions.flatMap(s => [s.ended_at, s.started_at].filter(Boolean) as string[])
  const fromSessionsMax = maxIso(fromSessions)
  if (fromSessionsMax) return fromSessionsMax
  if (dash.dailyStats.length > 0) {
    const lastDay = dash.dailyStats[dash.dailyStats.length - 1]!.date
    return `${lastDay}T12:00:00.000Z`
  }
  return null
}

function formatLastActivity(iso: string | null): { line: string; detail: string } {
  if (!iso) return { line: 'Jamais pratiqué', detail: 'Commence une première séance !' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { line: 'Récemment', detail: '' }

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startToday - dayStart) / 86400000)

  let line: string
  if (days === 0) line = "Aujourd'hui"
  else if (days === 1) line = 'Hier'
  else if (days >= 2 && days < 7) line = `Il y a ${days} jours`
  else if (days < 21) line = `Il y a ${Math.round(days / 7)} semaines`
  else line = `Il y a ${Math.round(days / 30)} mois`

  const detail = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return { line, detail }
}

export default function SubjectSelectorPage() {
  const params = useParams()
  const userId = params.userId as string

  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState<WordStat[]>([])
  const [verbs, setVerbs] = useState<VerbStat[]>([])
  const [math, setMath] = useState<MathProgress | null>(null)
  const [french, setFrench] = useState<FrenchDash | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/progress/${userId}`).then(r => r.json()),
      fetch(`/api/verbs/progress/${userId}`).then(r => r.json()),
      fetch(`/api/math/progress/${userId}`).then(r => r.json()),
      fetch(`/api/french/dashboard/${userId}`).then(r => (r.ok ? r.json() : null)),
    ]).then(([w, v, m, fr]) => {
      setWords(Array.isArray(w) ? w : [])
      setVerbs(Array.isArray(v) ? v : [])
      setMath(m)
      setFrench(fr)
      setLoading(false)
    })
  }, [userId])

  const totalWords = words.length
  const vocabMastered =
    words.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length
  const vocabAttempted = words.filter(w => w.total_attempts > 0).length
  const totalVerbCount = verbs.length
  const masteredVerbs =
    verbs.filter(v => v.total_attempts > 0 && v.avg_correct !== null && v.avg_correct / 6 >= 0.7).length
  const verbAttempted = verbs.filter(v => v.total_attempts > 0).length

  const totalAttemptsDe = words.reduce((s, w) => s + w.total_attempts, 0)
  const totalCorrectDe = words.reduce((s, w) => s + w.correct_attempts, 0)

  const germanDates = [...words.map(w => w.last_attempted), ...verbs.map(v => v.last_attempted)]
  const germanLast = maxIso(germanDates)
  const mathLast = math ? maxIso(math.by_table.map(t => t.last_attempted)) : null
  const frenchLast = lastFrenchIso(french)

  const germanProgressPct =
    totalWords + totalVerbCount > 0
      ? Math.round(((vocabMastered + masteredVerbs) / (totalWords + totalVerbCount)) * 100)
      : 0
  const mathPct =
    math && math.summary.total_attempts > 0
      ? Math.round((math.summary.total_correct / math.summary.total_attempts) * 100)
      : null
  const frenchPct =
    french && french.totalAttempts > 0 ? Math.round(french.overallAccuracy * 100) : null

  const rows = SUBJECT_DEFS.map(def => {
    if (def.id === 'german') {
      const last = formatLastActivity(germanLast)
      return {
        ...def,
        lastLabel: last.line,
        lastDetail: last.detail,
        stats: [
          `${vocabMastered}/${totalWords} mots solides (${vocabAttempted} avec essais)`,
          `${masteredVerbs}/${totalVerbCount} verbes solides (${verbAttempted} avec essais)`,
          ...(totalAttemptsDe > 0
            ? [`Vocabulaire : ${Math.round((totalCorrectDe / totalAttemptsDe) * 100)}% de réponses justes`]
            : []),
        ],
        barPct: germanProgressPct,
        extraLink: {
          label: 'Verbes allemands',
          href: `/${userId}/verbs`,
        },
      }
    }
    if (def.id === 'math') {
      const last = formatLastActivity(mathLast)
      const sess = math?.summary.sessions ?? 0
      const att = math?.summary.total_attempts ?? 0
      return {
        ...def,
        lastLabel: last.line,
        lastDetail: last.detail,
        stats: [
          sess > 0 ? `${sess} série${sess > 1 ? 's' : ''} terminée${sess > 1 ? 's' : ''}` : 'Aucune série terminée',
          att > 0 ? `${att} réponses · ${mathPct}% justes` : "Pas encore d'essais enregistrés",
        ],
        barPct: mathPct ?? (att > 0 ? Math.round(((math!.summary.total_correct / att) * 100)) : 0),
      }
    }
    const last = formatLastActivity(frenchLast)
    const att = french?.totalAttempts ?? 0
    const sess = french?.sessionsCompleted ?? 0
    return {
      ...def,
      lastLabel: last.line,
      lastDetail: last.detail,
      stats: [
        att > 0
          ? `${att} réponses · ${frenchPct ?? 0}% justes · ${sess} série${sess > 1 ? 's' : ''}`
          : 'Pas encore de conjugaison jouée',
      ],
      barPct: frenchPct ?? (att > 0 ? Math.round((french!.totalCorrect / att) * 100) : 0),
      extraLink: att > 0
        ? { label: 'Carte conjugaisons', href: `/${userId}/french/dashboard` }
        : undefined,
    }
  })

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <Link href="/" className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors">
            ← Changer de profil
          </Link>
          <h1 className="text-4xl font-extrabold text-primary mt-4 mb-1">Tableau de bord</h1>
          <p className="text-gray-500">Dernière activité, progression, et lien vers une séance</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white/80 px-8 py-16 text-center text-gray-400">
            Chargement…
          </div>
        ) : (
          <div className="flex flex-col gap-5 mb-10">
            {rows.map(row => (
              <div
                key={row.id}
                className={`rounded-2xl border-2 bg-white p-6 shadow-sm ${row.border}`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${row.color} flex items-center justify-center text-2xl shadow-md`}>
                    {row.flag}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-xl font-extrabold text-primary">{row.title}</h2>
                      <span className="text-sm text-gray-400">{row.subtitle}</span>
                    </div>
                    <p className={`mt-2 text-sm font-semibold ${row.accent}`}>
                      Dernière activité :{' '}
                      <span className="text-gray-900">{row.lastLabel}</span>
                      {row.lastDetail && (
                        <span className="font-normal text-gray-400">
                          {' '}
                          · {row.lastDetail}
                        </span>
                      )}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm text-gray-600">
                      {row.stats.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mb-1">
                        <span>Progression estimée</span>
                        <span>{row.barPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.bar} transition-all`}
                          style={{ width: `${Math.min(100, Math.max(0, row.barPct))}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={row.practiceHref(userId)}
                        className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm bg-gradient-to-r ${row.color} hover:opacity-95 transition-opacity`}
                      >
                        Réviser →
                      </Link>
                      <Link
                        href={`/${userId}/progress`}
                        className="inline-flex items-center justify-center rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-primary hover:bg-gray-50 transition-colors"
                      >
                        Détails
                      </Link>
                      {'extraLink' in row && row.extraLink && (
                        <Link
                          href={row.extraLink.href}
                          className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold ${row.accent} border-current/20 hover:bg-gray-50 transition-colors`}
                        >
                          {row.extraLink.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href={`/${userId}/checks`}
            className="text-sm font-semibold text-amber-800 border border-amber-300 rounded-xl px-4 py-2 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            Chèques
          </Link>
          <Link
            href={`/${userId}/progress`}
            className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors"
          >
            Vue détaillée complète →
          </Link>
        </div>
      </div>
    </div>
  )
}
