'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UnitVocabPractice } from '@/components/UnitVocabPractice'
import type { FrenchDashboardPayload, VerbTenseCell } from '@/lib/frenchDashboard'

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

interface EnglishWordStat {
  vocab_id: number
  french: string
  english: string
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

type HeatCell = { attempts: number; correct: number; accuracy: number; forms: VerbTenseCell['forms'] } | null

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

function buildHeatLookup(data: VerbTenseCell[]): Map<string, HeatCell> {
  const m = new Map<string, HeatCell>()
  for (const e of data) m.set(`${e.verbIndex}-${e.tenseIndex}`, { attempts: e.attempts, correct: e.correct, accuracy: e.accuracy, forms: e.forms })
  return m
}

function frPracticeHref(userId: string, opts: { verbs: string[]; tenses: string[]; fullVerbList?: string[]; fullTenseList?: string[] }): string {
  const verbs = opts.verbs.length > 0 ? opts.verbs.join(',') : (opts.fullVerbList ?? []).join(',')
  const tenses = opts.tenses.length > 0 ? opts.tenses.join(',') : (opts.fullTenseList ?? []).join(',')
  const p = new URLSearchParams()
  if (verbs) p.set('verbs', verbs)
  if (tenses) p.set('tenses', tenses)
  p.set('difficulty', 'easy')
  p.set('count', '10')
  return `/${userId}/french/quiz?${p.toString()}`
}

function HeatmapCell({ verb, tense, data, href }: { verb: string; tense: string; data: HeatCell; href: string }) {
  const [hover, setHover] = useState(false)
  const inner = data && data.forms.length > 0
    ? <div className="grid w-full grid-cols-3 gap-px px-0.5">{data.forms.map(f => <span key={f.questionId} title={`${f.pronoun}: ${f.status === 'correct' ? 'Réussi' : f.status === 'incorrect' ? 'Raté' : '—'}`} className="block h-2 rounded-sm border border-white/30" style={{ background: f.status === 'correct' ? 'rgba(34,197,94,0.95)' : f.status === 'incorrect' ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.45)' }} />)}</div>
    : <span className="text-[0.65rem] text-gray-400">—</span>
  const style = data !== null ? { ...cellAccuracyStyle(data.accuracy), transform: hover ? 'scale(1.08)' : undefined } : undefined
  return (
    <Link href={href} className={`relative flex h-14 w-12 shrink-0 items-center justify-center rounded transition-shadow ${data ? 'shadow-sm hover:shadow-md' : 'border border-dashed border-gray-200 bg-gray-50/80'}`} style={style} title={`Pratiquer ${verb} — ${tense}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {inner}
      {hover && data && <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[0.65rem] font-semibold text-white shadow-lg">{verb} · {tense}<br />{data.correct}/{data.attempts} ({Math.round(data.accuracy * 100)}%)</span>}
    </Link>
  )
}

function MiniBars({ label, rows }: { label: string; rows: { label: string; correct: number; incorrect: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.correct + r.incorrect))
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-extrabold text-primary">{label}</h3>
      {rows.length === 0 ? <p className="text-center text-sm text-gray-400">Pas encore de données.</p> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.label}>
            <div className="mb-0.5 flex justify-between text-xs font-medium text-gray-500"><span>{r.label}</span><span>{r.correct} ✓ / {r.incorrect} ✗</span></div>
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-100"><div className="bg-emerald-500 transition-all" style={{ width: `${(r.correct / max) * 100}%` }} /><div className="bg-rose-400 transition-all" style={{ width: `${(r.incorrect / max) * 100}%` }} /></div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

interface MathProgress {
  summary: {
    total_attempts: number
    correct_attempts: number
    total_seconds: number
    timer_attempts: number
    timer_correct: number
    total_sessions: number
  }
  detail: Array<{
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

const BRANCHES = ['global', 'allemand', 'english', 'math', 'français'] as const
type Branch = (typeof BRANCHES)[number]

export default function ProgressPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = params.userId as string

  const rawBranch = searchParams.get('branch') ?? 'global'
  const branch: Branch = (BRANCHES as readonly string[]).includes(rawBranch) ? rawBranch as Branch : 'global'

  function setBranch(b: Branch) {
    router.push(`/${userId}/progress?branch=${b}`)
  }

  const [words, setWords] = useState<WordStat[]>([])
  const [verbs, setVerbs] = useState<VerbStat[]>([])
  const [unitTimes, setUnitTimes] = useState<UnitTime[]>([])
  const [math, setMath] = useState<MathProgress | null>(null)
  const [french, setFrench] = useState<FrenchDashboardPayload | null>(null)
  const [englishWords, setEnglishWords] = useState<EnglishWordStat[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [detailUnit, setDetailUnit] = useState<number | 'all'>('all')
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/progress/${userId}`).then(r => r.json()),
      fetch(`/api/verbs/progress/${userId}`).then(r => r.json()),
      fetch(`/api/progress/${userId}/time`).then(r => r.json()),
      fetch(`/api/math/progress/${userId}`).then(r => r.json()),
      fetch(`/api/french/dashboard/${userId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/english/progress/${userId}`).then(r => r.ok ? r.json() : null),
    ]).then(([w, v, t, m, fr, en]) => {
      setWords(w.detail ?? [])
      setVerbs(v.detail ?? [])
      setUnitTimes(t)
      setMath(m)
      setFrench(fr?.detail ?? null)
      setEnglishWords(en?.detail ?? [])
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
  const mathCorrect = math?.summary.correct_attempts ?? 0
  const mathSeconds = math?.summary.total_seconds ?? 0
  const mathSessions = math?.summary.total_sessions ?? 0
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

  // French heatmap data
  const heatLookup = useMemo(() => french ? buildHeatLookup(french.verbTenseData) : new Map<string, HeatCell>(), [french])
  const dailyRows = useMemo(() => (french?.dailyStats ?? []).map(d => ({ label: new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), correct: d.correct, incorrect: d.incorrect })), [french])
  const weeklyRows = useMemo(() => (french?.weeklyStats ?? []).map(w => ({ label: new Date(w.weekStart + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), correct: w.correct, incorrect: w.incorrect })), [french])

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
            onClick={() => setBranch('english')}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${branch === 'english' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-emerald-600'}`}
          >
            Anglais
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

        {/* ── Global summary cards ── */}
        {branch === 'global' && (<>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">🇩🇪 Allemand</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-primary text-lg">Vocabulaire &amp; Conjugaison</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold text-emerald-500">{mastered}<span className="text-sm font-semibold text-gray-400">/{totalWords}</span></p>
                <p className="text-xs text-gray-400 mt-0.5">Mots maîtrisés</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">{totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) + '%' : '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Taux de réussite</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">{fmtTime(totalSeconds)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Temps de révision</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setBranch('allemand')}
                className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-light transition-colors"
              >
                Voir les détails →
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">🇬🇧 Anglais</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-primary text-lg">Vocabulaire anglais</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold text-emerald-500">
                  {(() => { const total = englishWords.length; const mastered = englishWords.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length; return <>{mastered}<span className="text-sm font-semibold text-gray-400">/{total}</span></> })()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Mots maîtrisés</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">
                  {(() => { const att = englishWords.reduce((s, w) => s + w.total_attempts, 0); const cor = englishWords.reduce((s, w) => s + w.correct_attempts, 0); return att > 0 ? Math.round((cor / att) * 100) + '%' : '—' })()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Taux de réussite</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">{englishWords.filter(w => w.total_attempts > 0).length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Mots tentés</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setBranch('english')}
                className="inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                Voir les détails →
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">➗ Mathématiques</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-primary text-lg">Tables de multiplication</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold text-emerald-500">{mathAttempts > 0 ? Math.round((mathCorrect / mathAttempts) * 100) + '%' : '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Taux de réussite</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-accent">{mathSessions}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sessions complétées</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">{fmtTime(mathSeconds)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Temps de révision</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setBranch('math')}
                className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-light transition-colors"
              >
                Voir les détails →
              </button>
            </div>
          </div>
        </>)}

        {/* ── Allemand tab: full stats ── */}
        {branch === 'allemand' && (
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

        {/* ── English tab: full stats ── */}
        {branch === 'english' && (() => {
          const enTotal = englishWords.length
          const enMastered = englishWords.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length
          const enToReview = englishWords.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts < 0.5).length
          const enNeverTried = englishWords.filter(w => w.total_attempts === 0).length
          const enAttempts = englishWords.reduce((s, w) => s + w.total_attempts, 0)
          const enCorrect = englishWords.reduce((s, w) => s + w.correct_attempts, 0)
          const enUnits = Array.from(new Set(englishWords.map(w => w.unit))).sort((a, b) => a - b)
          const enByUnit = new Map<number, EnglishWordStat[]>()
          for (const w of englishWords) {
            if (!enByUnit.has(w.unit)) enByUnit.set(w.unit, [])
            enByUnit.get(w.unit)!.push(w)
          }
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-3xl font-extrabold text-emerald-500">{enMastered}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">Mots maîtrisés</p>
                  <p className="text-xs text-gray-300 mt-0.5">sur {enTotal}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-3xl font-extrabold text-rose-400">{enToReview}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">À revoir</p>
                  <p className="text-xs text-gray-300 mt-0.5">{enNeverTried} jamais tentés</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-3xl font-extrabold text-primary">
                    {enAttempts > 0 ? Math.round((enCorrect / enAttempts) * 100) + '%' : '—'}
                  </p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">Taux anglais</p>
                  <p className="text-xs text-gray-300 mt-0.5">{enAttempts} essais</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-3xl font-extrabold text-primary">{englishWords.filter(w => w.total_attempts > 0).length}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">Mots tentés</p>
                  <p className="text-xs text-gray-300 mt-0.5">sur {enTotal}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-primary text-lg">Vocabulaire par unité</h2>
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
                  {enUnits.map(unit => {
                    const unitWords = enByUnit.get(unit) ?? []
                    const unitMastered = unitWords.filter(w => w.total_attempts > 0 && w.correct_attempts / w.total_attempts >= 0.7).length
                    const unitTitle = unitWords[0]?.unit_title ?? ''
                    return (
                      <div key={unit}>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wide">Unité {unit}</span>
                          <span className="text-xs text-gray-400 truncate">{unitTitle}</span>
                          <span className="ml-auto text-xs text-gray-400">{unitMastered}/{unitWords.length} maîtrisés</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${unitWords.length > 0 ? (unitMastered / unitWords.length) * 100 : 0}%` }} />
                        </div>
                        <UnitVocabPractice userId={userId} unit={unit} subject="english" />
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {unitWords.map(w => (
                            <div
                              key={w.vocab_id}
                              className={`w-7 h-7 rounded-md cursor-default transition-transform hover:scale-125 hover:z-10 relative ${wordColor(w.total_attempts, w.correct_attempts)}`}
                              title={`${w.french} → ${w.english}`}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="font-extrabold text-primary text-base">Détail des mots anglais</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Français</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Anglais</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🃏</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">🔊</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">✍️</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {englishWords.map(stat => {
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
                          <td className="px-4 py-2.5 font-semibold text-primary text-xs">{stat.english}</td>
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
              </div>
            </>
          )
        })()}

        {/* ── Math tab: full stats ── */}
        {branch === 'math' && (
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
        {branch === 'allemand' && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
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
        {branch === 'allemand' && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
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
        {branch === 'allemand' && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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

        {branch === 'math' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
            <h2 className="font-extrabold text-primary text-lg mb-4">Math — tables par série</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(math?.detail ?? []).map(t => {
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
                    {(math?.detail ?? []).map(t => {
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

        {branch === 'global' && (
          <div className="flex items-center gap-3 mt-8 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">🇫🇷 Français</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* ── Français: global summary card ── */}
        {branch === 'global' && (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="font-extrabold text-primary text-lg">Conjugaison française</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold text-emerald-500">{french && french.totalAttempts > 0 ? Math.round(french.overallAccuracy * 100) + '%' : '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Taux de réussite</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-accent">{french?.sessionsCompleted ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sessions complétées</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary">{french?.totalAttempts ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total réponses</p>
              </div>
            </div>
            <div className="mt-4">
              <button onClick={() => setBranch('français')} className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-light transition-colors">
                Voir les détails →
              </button>
            </div>
          </div>
        )}

        {/* ── Français: full dashboard ── */}
        {branch === 'français' && (
          <div className="space-y-6">
            {/* Hero stats */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-rose-400 p-8 text-white shadow-lg">
              <div className="relative z-[1] flex flex-wrap items-end gap-8">
                <div>
                  <p className="mb-1 text-sm opacity-80">Points français (sessions)</p>
                  <p className="text-5xl font-bold leading-none">{(french?.totalPoints ?? 0).toLocaleString('fr-FR')}</p>
                </div>
                <div className="flex flex-wrap gap-8 opacity-95">
                  <div><p className="text-3xl font-semibold">{french && french.totalAttempts > 0 ? Math.round(french.overallAccuracy * 100) + '%' : '—'}</p><p className="text-xs opacity-80">Exactitude</p></div>
                  <div><p className="text-3xl font-semibold">{french?.sessionsCompleted ?? 0}</p><p className="text-xs opacity-80">Sessions terminées</p></div>
                  <div><p className="text-3xl font-semibold">{french?.totalAttempts ?? 0}</p><p className="text-xs opacity-80">Réponses</p></div>
                </div>
              </div>
              <p className="relative z-[1] mt-4 max-w-xl text-sm opacity-75">
                1 point par bonne réponse, multiplicateur selon difficulté ; bonus séance parfaite (+5 ou +10). Les{' '}
                <Link href={`/${userId}/checks`} className="font-bold underline underline-offset-2 hover:opacity-100">chèques</Link>{' '}suivent tes points globaux.
              </p>
            </div>

            {/* Bars */}
            <div className="grid gap-6 md:grid-cols-2">
              <MiniBars label="Par jour" rows={dailyRows} />
              <MiniBars label="Par semaine (lundi)" rows={weeklyRows} />
            </div>

            {/* Heatmap */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-2 font-extrabold text-primary">Progression verbe × temps</h2>
              <p className="mb-4 text-sm text-gray-500">Clique sur une case pour t&apos;entraîner sur ce couple ; en-tête de colonne / ligne pour le verbe ou le temps seul.</p>
              {!french || french.verbs.length === 0 ? (
                <p className="text-gray-400">Aucun verbe dans le référentiel.</p>
              ) : (
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'min(520px, 70vh)' }}>
                  <div className="grid gap-px" style={{ gridTemplateColumns: `100px repeat(${french.verbs.length}, 48px)` }}>
                    <div />
                    {french.verbs.map(v => (
                      <Link key={v} href={frPracticeHref(userId, { verbs: [v], tenses: [], fullTenseList: french.tenses })} className="flex min-h-[3rem] flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[0.65rem] font-bold leading-tight text-primary hover:text-accent" title={`Pratiquer « ${v} »`}>
                        <span className="line-clamp-2">{v.length > 8 ? `${v.slice(0, 7)}…` : v}</span>
                        <span className="text-[0.55rem] opacity-60">▶</span>
                      </Link>
                    ))}
                    {french.tenses.map((tense, ti) => (
                      <div key={tense} className="contents">
                        <Link href={frPracticeHref(userId, { verbs: [], tenses: [tense], fullVerbList: french.verbs })} className="flex items-center justify-end pr-2 text-right text-[0.7rem] font-bold text-primary hover:text-accent" title={`Pratiquer le ${tense}`}>
                          {tense}<span className="ml-1 text-[0.55rem]">▶</span>
                        </Link>
                        {french.verbs.map((_v, vi) => (
                          <HeatmapCell key={`${vi}-${ti}`} verb={french.verbs[vi]} tense={tense} data={heatLookup.get(`${vi}-${ti}`) ?? null} href={frPracticeHref(userId, { verbs: [french.verbs[vi]], tenses: [tense] })} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[0.7rem] text-gray-500">
                <span>Réussite :</span>
                {[0.2, 0.4, 0.6, 0.8, 1].map(a => <span key={a} className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: cellAccuracyStyle(a).backgroundColor }} />)}
                <span>0 → 100 %</span>
                <span className="mx-2">|</span>
                <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-gray-300 bg-transparent" />
                <span>Pas encore vu</span>
              </div>
            </div>

            {/* By tense / by verb */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-3 font-extrabold text-primary">Par temps</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-gray-500"><th className="py-2 pr-2">Temps</th><th className="py-2 pr-2 text-right">Tent.</th><th className="py-2 text-right">%</th></tr></thead>
                    <tbody>{(french?.byTense ?? []).map(r => <tr key={r.key} className="border-b border-gray-50"><td className="py-2 font-medium text-primary">{r.key}</td><td className="py-2 text-right text-gray-500">{r.attempts}</td><td className="py-2 text-right font-semibold text-emerald-700">{Math.round(r.accuracy * 100)}%</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-3 font-extrabold text-primary">Par verbe</h3>
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="sticky top-0 border-b bg-white text-left text-gray-500"><th className="py-2 pr-2">Verbe</th><th className="py-2 pr-2 text-right">Tent.</th><th className="py-2 text-right">%</th></tr></thead>
                    <tbody>{(french?.byVerb ?? []).map(r => <tr key={r.key} className="border-b border-gray-50"><td className="py-2 font-medium text-primary">{r.key}</td><td className="py-2 text-right text-gray-500">{r.attempts}</td><td className="py-2 text-right font-semibold text-emerald-700">{Math.round(r.accuracy * 100)}%</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent sessions */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-extrabold text-primary">Sessions récentes</h3>
              {!french || french.recentSessions.length === 0 ? (
                <p className="text-gray-400">Aucune session. Lance une série depuis la page Français.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-gray-500"><th className="w-8 py-2" /><th className="py-2">Date</th><th className="py-2 text-right">Questions</th><th className="py-2 text-right">Score</th><th className="py-2 text-right">Points</th></tr></thead>
                    <tbody>
                      {french.recentSessions.map(s => {
                        const open = expandedSession === s.id
                        return (
                          <React.Fragment key={s.id}>
                            <tr className="cursor-pointer border-b border-gray-50 hover:bg-gray-50/80" onClick={() => setExpandedSession(open ? null : s.id)}>
                              <td className="py-2 text-center text-gray-400">{open ? '▾' : '▸'}</td>
                              <td className="py-2 font-medium">{new Date(s.started_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                              <td className="py-2 text-right text-gray-600">{s.answers_summary?.total ?? s.results.length ?? '—'}</td>
                              <td className="py-2 text-right">{s.answers_summary ? <><span className="text-emerald-600">{s.answers_summary.score}</span>{s.answers_summary.mistakes > 0 && <span className="text-gray-400"> ({s.answers_summary.mistakes} erreurs)</span>}</> : <span className="text-gray-400">—</span>}</td>
                              <td className="py-2 text-right font-semibold text-primary">{s.points ? `+${s.points}` : '—'}</td>
                            </tr>
                            {open && (
                              <tr key={`${s.id}-detail`} className="border-b border-gray-100 bg-gray-50/50">
                                <td colSpan={5} className="p-4">
                                  {s.results.length === 0 ? <p className="text-gray-400">Pas de réponses enregistrées pour cette session.</p> : (
                                    <table className="w-full text-xs">
                                      <thead><tr className="text-left text-gray-500"><th className="pb-2">Question</th><th className="pb-2">Réponse</th><th className="pb-2">Attendu</th><th className="pb-2 text-center">OK</th></tr></thead>
                                      <tbody>{s.results.map((row, i) => <tr key={`${s.id}-${i}`} className="border-t border-gray-100"><td className="py-1 font-medium">{row.verb} · {row.tense} · {row.pronoun}</td><td className="py-1 font-mono">{row.givenAnswer || '(vide)'}</td><td className="py-1 font-mono">{row.expectedAnswer}</td><td className="py-1 text-center">{row.isCorrect ? '✓' : '✗'}</td></tr>)}</tbody>
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

            <div className="pb-4 text-center">
              <Link href={`/${userId}/french`} className="inline-flex rounded-xl border-2 border-primary px-6 py-3 font-bold text-primary hover:bg-primary hover:text-white transition-colors">
                Configurer une nouvelle série →
              </Link>
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
