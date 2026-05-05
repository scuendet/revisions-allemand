'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { UnitVocabPractice } from '@/components/UnitVocabPractice'

interface WordStat {
  vocab_id: number
  french: string
  german: string
  unit: number
  unit_title: string
  total_attempts: number
  correct_attempts: number
  flashcard_attempts: number
  flashcard_correct: number
  audio_attempts: number
  audio_correct: number
  typing_attempts: number
  typing_correct: number
  last_attempted: string | null
}

interface UnitTime {
  unit: number
  total_seconds: number
  flashcard_seconds: number
  audio_seconds: number
  typing_seconds: number
}

interface VerbStat {
  verb_id: number
  unit: number
  infinitive: string
  french: string
  total_attempts: number
  avg_correct: number | null
  last_attempted: string | null
}

interface Tooltip {
  x: number
  y: number
  lines: string[]
}

interface MathProgress {
  summary: {
    total_attempts: number
    total_correct: number
    total_seconds: number
    timer_attempts: number
    timer_correct: number
    sessions: number
  }
  by_table: Array<{
    table: number
    attempts: number
    correct: number
    flashcard_attempts: number
    audio_attempts: number
    typing_attempts: number
    timer_attempts: number
    timer_correct: number
    last_attempted: string | null
  }>
}

function wordColor(total: number, correct: number): string {
  if (total === 0) return 'bg-gray-100 border border-gray-200'
  const r = correct / total
  if (r >= 0.8) return 'bg-emerald-500'
  if (r >= 0.6) return 'bg-emerald-300'
  if (r >= 0.4) return 'bg-amber-300'
  if (r >= 0.2) return 'bg-rose-300'
  return 'bg-rose-500'
}

function verbColor(total: number, avg: number | null): string {
  if (total === 0 || avg === null) return 'bg-gray-100 border border-gray-200'
  const r = avg / 6
  if (r >= 0.8) return 'bg-emerald-500'
  if (r >= 0.6) return 'bg-emerald-300'
  if (r >= 0.4) return 'bg-amber-300'
  if (r >= 0.2) return 'bg-rose-300'
  return 'bg-rose-500'
}

function pct(correct: number, total: number) {
  if (total === 0) return '—'
  return Math.round((correct / total) * 100) + '%'
}

function fmtTime(seconds: number): string {
  if (seconds === 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function ProgressPage() {
  const params = useParams()
  const userId = params.userId as string

  const [words, setWords] = useState<WordStat[]>([])
  const [verbs, setVerbs] = useState<VerbStat[]>([])
  const [unitTimes, setUnitTimes] = useState<UnitTime[]>([])
  const [math, setMath] = useState<MathProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [detailUnit, setDetailUnit] = useState<number | 'all'>('all')
  const [branch, setBranch] = useState<'global' | 'allemand' | 'math' | 'français'>('global')
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/progress/${userId}`).then(r => r.json()),
      fetch(`/api/verbs/progress/${userId}`).then(r => r.json()),
      fetch(`/api/progress/${userId}/time`).then(r => r.json()),
      fetch(`/api/math/progress/${userId}`).then(r => r.json()),
    ]).then(([w, v, t, m]) => {
      setWords(w)
      setVerbs(v)
      setUnitTimes(t)
      setMath(m)
      setLoading(false)
    })
  }, [userId])

  // Global vocab stats
  const totalWords = words.length
  const attempted = words.filter(w => w.total_attempts > 0).length
  const mastered = words.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length
  const toReview = words.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts < 0.5).length
  const neverTried = words.filter(w => w.total_attempts === 0).length
  const totalAttempts = words.reduce((s, w) => s + w.total_attempts, 0)
  const totalCorrect = words.reduce((s, w) => s + w.correct_attempts, 0)

  // Global verb stats
  const masteredVerbs = verbs.filter(v => v.total_attempts > 0 && v.avg_correct !== null && v.avg_correct / 6 >= 0.7).length

  // Time stats
  const totalSeconds = unitTimes.reduce((s, t) => s + t.total_seconds, 0)
  const timeByUnit = new Map(unitTimes.map(t => [t.unit, t]))
  const mathAttempts = math?.summary.total_attempts ?? 0
  const mathCorrect = math?.summary.total_correct ?? 0
  const mathSeconds = math?.summary.total_seconds ?? 0
  const mathSessions = math?.summary.sessions ?? 0
  const globalSeconds = totalSeconds + mathSeconds

  // Group words by unit
  const units = Array.from(new Set(words.map(w => w.unit))).sort((a, b) => a - b)
  const wordsByUnit = new Map<number, WordStat[]>()
  for (const w of words) {
    if (!wordsByUnit.has(w.unit)) wordsByUnit.set(w.unit, [])
    wordsByUnit.get(w.unit)!.push(w)
  }

  // Group verbs by unit
  const verbUnits = Array.from(new Set(verbs.map(v => v.unit))).sort((a, b) => a - b)
  const verbsByUnit = new Map<number, VerbStat[]>()
  for (const v of verbs) {
    if (!verbsByUnit.has(v.unit)) verbsByUnit.set(v.unit, [])
    verbsByUnit.get(v.unit)!.push(v)
  }

  function showWordTooltip(e: React.MouseEvent, w: WordStat) {
    const rate = w.total_attempts > 0 ? Math.round((w.correct_attempts / w.total_attempts) * 100) : null
    const modeLine = (label: string, correct: number, total: number) =>
      total > 0 ? `${label} ${correct}/${total} (${Math.round((correct / total) * 100)}%)` : null
    const modeLines = [
      modeLine('🃏 Flashcards :', w.flashcard_correct, w.flashcard_attempts),
      modeLine('🔊 Audio :', w.audio_correct, w.audio_attempts),
      modeLine('✍️ Écriture :', w.typing_correct, w.typing_attempts),
    ].filter(Boolean) as string[]
    const unitTime = timeByUnit.get(w.unit)
    const timeLine = unitTime && unitTime.total_seconds > 0
      ? `⏱ Unité ${w.unit} : ${fmtTime(unitTime.total_seconds)}`
      : null
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      lines: [
        w.german,
        w.french,
        w.total_attempts === 0 ? 'Jamais tenté' : `Total : ${w.correct_attempts}/${w.total_attempts} (${rate}%)`,
        ...modeLines,
        ...(timeLine ? [timeLine] : []),
      ],
    })
  }

  function showVerbTooltip(e: React.MouseEvent, v: VerbStat) {
    const rate = v.total_attempts > 0 && v.avg_correct !== null ? Math.round((v.avg_correct / 6) * 100) : null
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      lines: [
        v.infinitive,
        v.french,
        v.total_attempts === 0 ? 'Jamais tenté' : `moy. ${v.avg_correct?.toFixed(1)}/6 formes (${rate}%)`,
      ],
    })
  }

  const filteredWords = detailUnit === 'all' ? words : words.filter(w => w.unit === detailUnit)
  const detailUnitTitle = detailUnit !== 'all' ? words.find(w => w.unit === detailUnit)?.unit_title : undefined

  // Legend items
  const legend = [
    { color: 'bg-emerald-500', label: '≥ 80%' },
    { color: 'bg-emerald-300', label: '60–80%' },
    { color: 'bg-amber-300', label: '40–60%' },
    { color: 'bg-rose-300', label: '20–40%' },
    { color: 'bg-rose-500', label: '< 20%' },
    { color: 'bg-gray-100 border border-gray-200', label: 'Jamais' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-400">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6" onMouseMove={e => {
      if (tooltip) setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
    }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <Link href={`/${userId}`} className="text-gray-400 hover:text-primary transition-colors font-semibold">← Retour</Link>
          <h1 className="text-2xl font-extrabold text-primary">Vue détaillée des progrès</h1>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/${userId}/french/dashboard`}
              className="text-sm font-semibold text-rose-800 border border-rose-300 rounded-xl px-3 py-1.5 bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              Français — conjugaison →
            </Link>
            <Link
              href={`/${userId}/checks`}
              className="text-sm font-semibold text-amber-800 border border-amber-300 rounded-xl px-3 py-1.5 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              Chèques
            </Link>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 mb-6">
          <button
            onClick={() => setBranch('global')}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${branch === 'global' ? 'bg-primary text-white' : 'text-gray-500 hover:text-primary'}`}
          >
            Global
          </button>
          <button
            onClick={() => setBranch('allemand')}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${branch === 'allemand' ? 'bg-primary text-white' : 'text-gray-500 hover:text-primary'}`}
          >
            Allemand
          </button>
          <button
            onClick={() => setBranch('math')}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${branch === 'math' ? 'bg-primary text-white' : 'text-gray-500 hover:text-primary'}`}
          >
            Math
          </button>
          <button
            onClick={() => setBranch('français')}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${branch === 'français' ? 'bg-rose-600 text-white' : 'text-gray-500 hover:text-rose-600'}`}
          >
            Français
          </button>
        </div>

        {branch === 'français' && (
          <div className="mb-8 rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-primary text-lg">Conjugaison française</h2>
            <p className="mt-2 text-sm text-gray-500">
              Carte verbes × temps, stats par jour, sessions et lien vers une nouvelle série.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/${userId}/french/dashboard`}
                className="inline-flex rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition-colors"
              >
                Ouvrir le dashboard →
              </Link>
              <Link
                href={`/${userId}/french`}
                className="inline-flex rounded-xl border-2 border-rose-200 px-5 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-50 transition-colors"
              >
                Configurer une série →
              </Link>
            </div>
          </div>
        )}

        {(branch === 'global' || branch === 'allemand') && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-emerald-500">{mastered}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Mots maîtrisés</p>
              <p className="text-xs text-gray-300 mt-0.5">sur {totalWords}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-rose-400">{toReview}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">À revoir</p>
              <p className="text-xs text-gray-300 mt-0.5">{neverTried} jamais tentés</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-primary">
                {totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) + '%' : '—'}
              </p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Taux allemand</p>
              <p className="text-xs text-gray-300 mt-0.5">{totalAttempts} essais</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-accent">{masteredVerbs}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Verbes maîtrisés</p>
              <p className="text-xs text-gray-300 mt-0.5">sur {verbs.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-primary">{fmtTime(totalSeconds)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Temps allemand</p>
              <p className="text-xs text-gray-300 mt-0.5">révision</p>
            </div>
          </div>
        )}

        {(branch === 'global' || branch === 'math') && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-primary">{mathAttempts}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Essais math</p>
              <p className="text-xs text-gray-300 mt-0.5">tables</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-emerald-500">
                {mathAttempts > 0 ? Math.round((mathCorrect / mathAttempts) * 100) + '%' : '—'}
              </p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Taux math</p>
              <p className="text-xs text-gray-300 mt-0.5">{mathCorrect} correctes</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-accent">{mathSessions}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Sessions math</p>
              <p className="text-xs text-gray-300 mt-0.5">complétées</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-primary">{fmtTime(mathSeconds)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Temps math</p>
              <p className="text-xs text-gray-300 mt-0.5">révision</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-extrabold text-primary">{fmtTime(globalSeconds)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Temps global</p>
              <p className="text-xs text-gray-300 mt-0.5">allemand + math</p>
            </div>
          </div>
        )}

        {/* ── Vocabulary heatmap ── */}
        {(branch === 'global' || branch === 'allemand') && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-primary text-lg">Vocabulaire par unité</h2>
            {/* Legend */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {legend.map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className="text-xs text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {units.map(unit => {
              const unitWords = wordsByUnit.get(unit) ?? []
              const unitMastered = unitWords.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length
              const unitAttempted = unitWords.filter(w => w.total_attempts > 0).length
              const unitTitle = unitWords[0]?.unit_title ?? ''
              return (
                <div key={unit}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">Unité {unit}</span>
                    <span className="text-xs text-gray-400 truncate">{unitTitle}</span>
                    <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                      {timeByUnit.has(unit) && (
                        <span className="text-xs text-gray-300">⏱ {fmtTime(timeByUnit.get(unit)!.total_seconds)}</span>
                      )}
                      <span className="text-xs text-gray-400">{unitMastered}/{unitWords.length} maîtrisés</span>
                    </span>
                  </div>
                  {/* Progress bar for unit */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${unitWords.length > 0 ? (unitMastered / unitWords.length) * 100 : 0}%` }}
                    />
                  </div>
                  <UnitVocabPractice userId={userId} unit={unit} />
                  {/* Word cells */}
                  <div className="flex flex-wrap gap-1.5">
                    {unitWords.map(w => (
                      <div
                        key={w.vocab_id}
                        className={`w-7 h-7 rounded-md cursor-default transition-transform hover:scale-125 hover:z-10 relative ${wordColor(w.total_attempts, w.correct_attempts)}`}
                        onMouseEnter={e => showWordTooltip(e, w)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>}

        {/* ── Verb heatmap ── */}
        {(branch === 'global' || branch === 'allemand') && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="font-extrabold text-primary text-lg mb-4">Conjugaison des verbes</h2>
          <div className="space-y-5">
            {verbUnits.map(unit => {
              const unitVerbs = verbsByUnit.get(unit) ?? []
              const unitMastered = unitVerbs.filter(v => v.total_attempts > 0 && v.avg_correct !== null && v.avg_correct / 6 >= 0.7).length
              const unitLabel = unit === 0 ? 'Verbes de base' : `Unité ${unit}`
              return (
                <div key={unit}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">{unitLabel}</span>
                    <span className="ml-auto text-xs text-gray-400">{unitMastered}/{unitVerbs.length} maîtrisés</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${unitVerbs.length > 0 ? (unitMastered / unitVerbs.length) * 100 : 0}%` }}
                    />
                  </div>
                  {/* Verb pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {unitVerbs.map(v => (
                      <div
                        key={v.verb_id}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-default transition-transform hover:scale-105 hover:z-10 relative ${verbColor(v.total_attempts, v.avg_correct)} ${v.total_attempts > 0 ? 'text-white' : 'text-gray-400'}`}
                        onMouseEnter={e => showVerbTooltip(e, v)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {v.infinitive}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>}

        {/* ── Word detail table ── */}
        {(branch === 'global' || branch === 'allemand') && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {detailUnit !== 'all' && (
            <div className="p-4 border-b border-gray-100 bg-accent/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-primary">
                Unité {detailUnit}
                {detailUnitTitle && (
                  <span className="font-normal text-gray-500"> — {detailUnitTitle}</span>
                )}
              </p>
              <UnitVocabPractice userId={userId} unit={detailUnit} />
            </div>
          )}
          <div className="p-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-primary text-base mr-2">Détail des mots</h2>
            <button
              onClick={() => setDetailUnit('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${detailUnit === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Tout
            </button>
            {units.map(u => (
              <button
                key={u}
                onClick={() => setDetailUnit(u)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${detailUnit === u ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                U{u}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Français</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Allemand</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🃏</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🔊</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">✍️</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredWords.map(stat => {
                const rate = stat.total_attempts > 0 ? stat.correct_attempts / stat.total_attempts : null
                const bg = stat.total_attempts === 0 ? '' : rate! >= 0.7 ? 'bg-emerald-50' : rate! < 0.5 ? 'bg-rose-50' : 'bg-amber-50'
                const modeCell = (correct: number, total: number) => {
                  if (total === 0) return <span className="text-gray-300">—</span>
                  const r = correct / total
                  const cls = r >= 0.7 ? 'text-emerald-500' : r < 0.5 ? 'text-rose-400' : 'text-amber-500'
                  return <span className={`font-bold ${cls}`}>{Math.round(r * 100)}%</span>
                }
                return (
                  <tr key={stat.vocab_id} className={`border-b border-gray-50 last:border-0 ${bg}`}>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{stat.french}</td>
                    <td className="px-4 py-2.5 font-semibold text-primary text-xs">{stat.german}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{modeCell(stat.flashcard_correct, stat.flashcard_attempts)}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{modeCell(stat.audio_correct, stat.audio_attempts)}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{modeCell(stat.typing_correct, stat.typing_attempts)}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-xs">
                      <span className={rate === null ? 'text-gray-300' : rate >= 0.7 ? 'text-emerald-500' : rate < 0.5 ? 'text-rose-400' : 'text-amber-500'}>
                        {pct(stat.correct_attempts, stat.total_attempts)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}

        {(branch === 'global' || branch === 'math') && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
            <h2 className="font-extrabold text-primary text-lg mb-4">Math — tables par série</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(math?.by_table ?? []).map(t => {
                const rate = t.attempts > 0 ? t.correct / t.attempts : 0
                const bg = t.attempts === 0
                  ? 'bg-gray-50 border-gray-200 text-gray-400'
                  : rate >= 0.7
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : rate >= 0.5
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                return (
                  <div key={t.table} className={`rounded-xl border p-3 ${bg}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide">Table de {t.table}</p>
                    <p className="text-lg font-extrabold mt-1">
                      {t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) + '%' : '—'}
                    </p>
                    <p className="text-xs mt-0.5">{t.correct}/{t.attempts} correctes</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <h3 className="font-extrabold text-primary text-base mb-3">Résultats détaillés des livrets</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Livret</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Total</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Correct</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Taux</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🃏</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🔊</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">✍️</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Timer ON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(math?.by_table ?? []).map(t => {
                      const rate = t.attempts > 0 ? t.correct / t.attempts : null
                      const timerRate = t.timer_attempts > 0 ? t.timer_correct / t.timer_attempts : null
                      const rowBg =
                        t.attempts === 0
                          ? ''
                          : rate !== null && rate >= 0.7
                            ? 'bg-emerald-50'
                            : rate !== null && rate < 0.5
                              ? 'bg-rose-50'
                              : 'bg-amber-50'
                      return (
                        <tr key={`detail-${t.table}`} className={`border-b border-gray-50 last:border-0 ${rowBg}`}>
                          <td className="px-3 py-2.5 font-semibold text-primary text-xs">Table de {t.table}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{t.attempts}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{t.correct}</td>
                          <td className="px-3 py-2.5 text-center text-xs font-bold">
                            <span className={rate === null ? 'text-gray-300' : rate >= 0.7 ? 'text-emerald-500' : rate < 0.5 ? 'text-rose-400' : 'text-amber-500'}>
                              {pct(t.correct, t.attempts)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{t.flashcard_attempts}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{t.audio_attempts}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{t.typing_attempts}</td>
                          <td className="px-3 py-2.5 text-center text-xs">
                            <span className={timerRate === null ? 'text-gray-300' : timerRate >= 0.7 ? 'text-emerald-500 font-bold' : timerRate < 0.5 ? 'text-rose-400 font-bold' : 'text-amber-500 font-bold'}>
                              {timerRate === null ? '—' : `${Math.round(timerRate * 100)}%`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating tooltip ── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl max-w-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.lines.map((l, i) => (
            <p key={i} className={i === 0 ? 'font-bold' : i === 1 ? 'text-gray-300' : 'text-gray-400 mt-0.5'}>{l}</p>
          ))}
        </div>
      )}
    </div>
  )
}
