'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { FrenchDashboardPayload, VerbTenseCell } from '@/lib/frenchDashboard'

function cellAccuracyStyle(accuracy: number): { backgroundColor: string; color: string } {
  if (accuracy >= 0.9) return { backgroundColor: '#059669', color: 'white' }
  if (accuracy >= 0.8) return { backgroundColor: '#10b981', color: 'white' }
  if (accuracy >= 0.7) return { backgroundColor: '#34d399', color: '#064e3b' }
  if (accuracy >= 0.6) return { backgroundColor: '#fbbf24', color: '#78350f' }
  if (accuracy >= 0.5) return { backgroundColor: '#f59e0b', color: '#78350f' }
  if (accuracy >= 0.4) return { backgroundColor: '#f97316', color: 'white' }
  if (accuracy >= 0.3) return { backgroundColor: '#ef4444', color: 'white' }
  return { backgroundColor: '#dc2626', color: 'white' }
}

type HeatCell = {
  attempts: number
  correct: number
  accuracy: number
  forms: VerbTenseCell['forms']
} | null

function buildLookup(data: VerbTenseCell[]): Map<string, HeatCell> {
  const m = new Map<string, HeatCell>()
  for (const e of data) {
    m.set(`${e.verbIndex}-${e.tenseIndex}`, {
      attempts: e.attempts,
      correct: e.correct,
      accuracy: e.accuracy,
      forms: e.forms,
    })
  }
  return m
}

function practiceHref(
  userId: string,
  opts: { verbs: string[]; tenses: string[]; fullVerbList?: string[]; fullTenseList?: string[] },
): string {
  const verbs =
    opts.verbs.length > 0
      ? opts.verbs.join(',')
      : opts.fullVerbList?.length
        ? opts.fullVerbList.join(',')
        : ''
  const tenses =
    opts.tenses.length > 0
      ? opts.tenses.join(',')
      : opts.fullTenseList?.length
        ? opts.fullTenseList.join(',')
        : ''
  const p = new URLSearchParams()
  if (verbs) p.set('verbs', verbs)
  if (tenses) p.set('tenses', tenses)
  p.set('difficulty', 'easy')
  p.set('count', '10')
  return `/${userId}/french/quiz?${p.toString()}`
}

function HeatmapCell({
  verb,
  tense,
  data,
  href,
}: {
  verb: string
  tense: string
  data: HeatCell
  href: string
}) {
  const [hover, setHover] = useState(false)

  const inner =
    data && data.forms.length > 0 ? (
      <div className="grid w-full grid-cols-3 gap-px px-0.5">
        {data.forms.map(form => (
          <span
            key={form.questionId}
            title={`${form.pronoun}: ${
              form.status === 'correct' ? 'Réussi' : form.status === 'incorrect' ? 'Raté' : '—'
            }`}
            className="block h-2 rounded-sm border border-white/30"
            style={{
              background:
                form.status === 'correct'
                  ? 'rgba(34,197,94,0.95)'
                  : form.status === 'incorrect'
                    ? 'rgba(239,68,68,0.95)'
                    : 'rgba(255,255,255,0.45)',
            }}
          />
        ))}
      </div>
    ) : (
      <span className="text-[0.65rem] text-gray-400">—</span>
    )

  const style =
    data !== null ? { ...cellAccuracyStyle(data.accuracy), transform: hover ? 'scale(1.08)' : undefined } : undefined

  return (
    <Link
      href={href}
      className={`relative flex h-14 w-12 shrink-0 items-center justify-center rounded transition-shadow ${
        data ? 'shadow-sm hover:shadow-md' : 'border border-dashed border-gray-200 bg-gray-50/80'
      }`}
      style={style}
      title={`Pratiquer ${verb} — ${tense}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {inner}
      {hover && data && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[0.65rem] font-semibold text-white shadow-lg">
          {verb} · {tense}
          <br />
          {data.correct}/{data.attempts} ({Math.round(data.accuracy * 100)}%)
        </span>
      )}
    </Link>
  )
}

function MiniBars({
  label,
  rows,
}: {
  label: string
  rows: { label: string; correct: number; incorrect: number }[]
}) {
  const max = Math.max(1, ...rows.map(r => r.correct + r.incorrect))
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-extrabold text-primary">{label}</h3>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-gray-400">Pas encore de données.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const total = r.correct + r.incorrect
            const wC = (r.correct / max) * 100
            const wI = (r.incorrect / max) * 100
            return (
              <div key={r.label}>
                <div className="mb-0.5 flex justify-between text-xs font-medium text-gray-500">
                  <span>{r.label}</span>
                  <span>
                    {r.correct} ✓ / {r.incorrect} ✗
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${wC}%` }} />
                  <div className="bg-rose-400 transition-all" style={{ width: `${wI}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FrenchConjugationDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [data, setData] = useState<FrenchDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/french/dashboard/${userId}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: FrenchDashboardPayload) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId])

  const lookup = useMemo(() => (data ? buildLookup(data.verbTenseData) : new Map<string, HeatCell>()), [data])

  const dailyRows = useMemo(() => {
    if (!data) return []
    return data.dailyStats.map(d => ({
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      correct: d.correct,
      incorrect: d.incorrect,
    }))
  }, [data])

  const weeklyRows = useMemo(() => {
    if (!data) return []
    return data.weeklyStats.map(w => ({
      label: new Date(w.weekStart + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      correct: w.correct,
      incorrect: w.incorrect,
    }))
  }, [data])

  const [expandedSession, setExpandedSession] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl text-center text-gray-400">Chargement…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl text-center text-rose-600">Impossible de charger le dashboard.</div>
        <div className="mt-4 text-center">
          <Link href={`/${userId}/french`} className="font-semibold text-primary hover:underline">
            ← Français
          </Link>
        </div>
      </div>
    )
  }

  const pct = Math.round(data.overallAccuracy * 100)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href={`/${userId}/french`} className="text-sm font-semibold text-gray-400 hover:text-primary">
            ← Français
          </Link>
          <span className="text-gray-200">|</span>
          <h1 className="text-2xl font-extrabold text-primary">Dashboard conjugaison</h1>
        </div>

        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-rose-400 p-8 text-white shadow-lg">
          <div className="relative z-[1] flex flex-wrap items-end gap-8">
            <div>
              <p className="mb-1 text-sm opacity-80">Points français (sessions)</p>
              <p className="font-display text-5xl font-bold leading-none">{data.totalPoints.toLocaleString('fr-FR')}</p>
            </div>
            <div className="flex flex-wrap gap-8 opacity-95">
              <div>
                <p className="text-3xl font-semibold">{pct}%</p>
                <p className="text-xs opacity-80">Exactitude</p>
              </div>
              <div>
                <p className="text-3xl font-semibold">{data.sessionsCompleted}</p>
                <p className="text-xs opacity-80">Sessions terminées</p>
              </div>
              <div>
                <p className="text-3xl font-semibold">{data.totalAttempts}</p>
                <p className="text-xs opacity-80">Réponses</p>
              </div>
            </div>
          </div>
          <p className="relative z-[1] mt-4 max-w-xl text-sm opacity-75">
            1 point par bonne réponse, multiplicateur selon difficulté ; bonus séance parfaite (+5 ou +10). Les{' '}
            <Link href={`/${userId}/checks`} className="font-bold underline underline-offset-2 hover:opacity-100">
              chèques
            </Link>{' '}
            suivent tes points globaux.
          </p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <MiniBars label="Par jour" rows={dailyRows} />
          <MiniBars label="Par semaine (lundi)" rows={weeklyRows} />
        </div>

        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-extrabold text-primary">Progression verbe × temps</h2>
          <p className="mb-4 text-sm text-gray-500">
            Clique sur une case pour t&apos;entraîner sur ce couple ; en-tête de colonne / ligne pour le verbe ou le
            temps seul.
          </p>
          {data.verbs.length === 0 ? (
            <p className="text-gray-400">Aucun verbe dans le référentiel.</p>
          ) : (
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'min(520px, 70vh)' }}>
              <div
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `100px repeat(${data.verbs.length}, 48px)`,
                }}
              >
                <div />
                {data.verbs.map(v => (
                  <Link
                    key={v}
                    href={practiceHref(userId, {
                      verbs: [v],
                      tenses: [],
                      fullTenseList: data.tenses,
                    })}
                    className="flex min-h-[3rem] flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[0.65rem] font-bold leading-tight text-primary hover:text-accent"
                    title={`Pratiquer « ${v} »`}
                  >
                    <span className="line-clamp-2">{v.length > 8 ? `${v.slice(0, 7)}…` : v}</span>
                    <span className="text-[0.55rem] opacity-60">▶</span>
                  </Link>
                ))}
                {data.tenses.map((tense, ti) => (
                  <div key={tense} className="contents">
                    <Link
                      href={practiceHref(userId, {
                        verbs: [],
                        tenses: [tense],
                        fullVerbList: data.verbs,
                      })}
                      className="flex items-center justify-end pr-2 text-right text-[0.7rem] font-bold text-primary hover:text-accent"
                      title={`Pratiquer le ${tense}`}
                    >
                      {tense}
                      <span className="ml-1 text-[0.55rem]">▶</span>
                    </Link>
                    {data.verbs.map((_verb, vi) => (
                      <HeatmapCell
                        key={`${vi}-${ti}`}
                        verb={data.verbs[vi]}
                        tense={tense}
                        data={lookup.get(`${vi}-${ti}`) ?? null}
                        href={practiceHref(userId, {
                          verbs: [data.verbs[vi]],
                          tenses: [tense],
                        })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[0.7rem] text-gray-500">
            <span>Réussite :</span>
            {[0.2, 0.4, 0.6, 0.8, 1].map(a => (
              <span
                key={a}
                className="inline-block h-3 w-5 rounded-sm"
                style={{ backgroundColor: cellAccuracyStyle(a).backgroundColor }}
              />
            ))}
            <span>0 → 100 %</span>
            <span className="mx-2">|</span>
            <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-gray-300 bg-transparent" />
            <span>Pas encore vu</span>
          </div>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-extrabold text-primary">Par temps</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-2">Temps</th>
                    <th className="py-2 pr-2 text-right">Tent.</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byTense.map(r => (
                    <tr key={r.key} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-primary">{r.key}</td>
                      <td className="py-2 text-right text-gray-500">{r.attempts}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">
                        {Math.round(r.accuracy * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-extrabold text-primary">Par verbe</h3>
            <div className="max-h-64 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 border-b bg-white text-left text-gray-500">
                    <th className="py-2 pr-2">Verbe</th>
                    <th className="py-2 pr-2 text-right">Tent.</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byVerb.map(r => (
                    <tr key={r.key} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-primary">{r.key}</td>
                      <td className="py-2 text-right text-gray-500">{r.attempts}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">
                        {Math.round(r.accuracy * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-extrabold text-primary">Sessions récentes</h3>
          {data.recentSessions.length === 0 ? (
            <p className="text-gray-400">Aucune session. Lance une série depuis la page Français.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="w-8 py-2" />
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Questions</th>
                    <th className="py-2 text-right">Score</th>
                    <th className="py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.map(s => {
                    const open = expandedSession === s.id
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          className="cursor-pointer border-b border-gray-50 hover:bg-gray-50/80"
                          onClick={() => setExpandedSession(open ? null : s.id)}
                        >
                          <td className="py-2 text-center text-gray-400">{open ? '▾' : '▸'}</td>
                          <td className="py-2 font-medium">
                            {new Date(s.started_at).toLocaleString('fr-FR', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            {s.answers_summary?.total ?? s.results.length ?? '—'}
                          </td>
                          <td className="py-2 text-right">
                            {s.answers_summary ? (
                              <>
                                <span className="text-emerald-600">{s.answers_summary.score}</span>
                                {s.answers_summary.mistakes > 0 && (
                                  <span className="text-gray-400"> ({s.answers_summary.mistakes} erreurs)</span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold text-primary">
                            {s.points ? `+${s.points}` : '—'}
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${s.id}-detail`} className="border-b border-gray-100 bg-gray-50/50">
                            <td colSpan={5} className="p-4">
                              {s.results.length === 0 ? (
                                <p className="text-gray-400">Pas de réponses enregistrées pour cette session.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-gray-500">
                                      <th className="pb-2">Question</th>
                                      <th className="pb-2">Réponse</th>
                                      <th className="pb-2">Attendu</th>
                                      <th className="pb-2 text-center">OK</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.results.map((row, i) => (
                                      <tr key={`${s.id}-${i}`} className="border-t border-gray-100">
                                        <td className="py-1 font-medium">
                                          {row.verb} · {row.tense} · {row.pronoun}
                                        </td>
                                        <td className="py-1 font-mono">{row.givenAnswer || '(vide)'}</td>
                                        <td className="py-1 font-mono">{row.expectedAnswer}</td>
                                        <td className="py-1 text-center">{row.isCorrect ? '✓' : '✗'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => router.push(`/${userId}/french`)}
            className="rounded-xl border-2 border-primary px-6 py-3 font-bold text-primary hover:bg-primary hover:text-white"
          >
            Configurer une série →
          </button>
        </div>
      </div>
    </div>
  )
}
