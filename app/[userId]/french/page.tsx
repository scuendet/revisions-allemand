'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_VERBES_5P_GROUP } from '@/lib/verbGroups'

const ALL_TENSES = ['présent', 'imparfait', 'conditionnel', 'passé composé', 'futur', 'impératif', 'plus-que-parfait', 'futur antérieur']
const ALL_VERBS = [
  'avoir', 'être', 'chanter', 'oublier', 'manger', 'commencer', 'peler', 'acheter',
  'employer', 'envoyer', 'payer', 'aller', 'finir', 'sortir', 'courir', 'venir',
  'pouvoir', 'vouloir', 'devoir', 'recevoir', 'savoir', 'pleuvoir', 'voir', 'croire',
  'écrire', 'lire', 'dire', 'faire', 'mettre', 'connaître', 'entendre', 'prendre',
]

const DIFFICULTIES = [
  { id: 'easy', label: 'Facile', desc: 'Surtout des questions maîtrisées', multiplier: '×1', color: 'emerald' },
  { id: 'medium', label: 'Moyen', desc: 'Mix maîtrisé / à retravailler', multiplier: '×2', color: 'amber' },
  { id: 'hard', label: 'Difficile', desc: 'Surtout des questions à retravailler', multiplier: '×5', color: 'rose' },
] as const

export default function FrenchHubPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()

  const [selectedVerbs, setSelectedVerbs] = useState<string[]>([...ALL_VERBS])
  const [selectedTenses, setSelectedTenses] = useState<string[]>([...ALL_TENSES])
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy')
  const [count, setCount] = useState<10 | 20 | 'all'>(10)
  const [verbsOpen, setVerbsOpen] = useState(false)
  const [tensesOpen, setTensesOpen] = useState(false)
  const [unmasteredVerbTenses, setUnmasteredVerbTenses] = useState<Set<string>>(new Set())

  const hasEnoughUnmastered = selectedVerbs.some(v =>
    selectedTenses.some(t => unmasteredVerbTenses.has(`${v}|${t}`))
  )
  const canUseHardMode =
    selectedTenses.length >= 4 &&
    selectedVerbs.length >= 10 &&
    hasEnoughUnmastered

  useEffect(() => {
    fetch(`/api/french/mastered?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.unmasteredVerbTenses)) {
          setUnmasteredVerbTenses(new Set(data.unmasteredVerbTenses))
        }
      })
      .catch(() => {})
  }, [userId])

  // Auto-downgrade if hard mode becomes ineligible
  useEffect(() => {
    if (difficulty === 'hard' && !canUseHardMode) {
      setDifficulty('medium')
    }
  }, [difficulty, canUseHardMode])

  function toggleVerb(v: string) {
    setSelectedVerbs(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleTense(t: string) {
    setSelectedTenses(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function applyVerbes5PGroup() {
    const base = new Set(DEFAULT_VERBES_5P_GROUP.verbs)
    if (DEFAULT_VERBES_5P_GROUP.include_first_group_er) {
      for (const v of ALL_VERBS) {
        if (v.endsWith('er')) base.add(v)
      }
    }
    const filtered = ALL_VERBS.filter(v => base.has(v))
    setSelectedVerbs(filtered)
    setVerbsOpen(false)
  }

  function handleSetDifficulty(d: 'easy' | 'medium' | 'hard') {
    if (d === 'hard' && !canUseHardMode) return
    setDifficulty(d)
  }

  function startQuiz() {
    if (selectedVerbs.length === 0 || selectedTenses.length === 0) return
    const effectiveDifficulty = difficulty === 'hard' && !canUseHardMode ? 'medium' : difficulty
    const p = new URLSearchParams({
      verbs: selectedVerbs.join(','),
      tenses: selectedTenses.join(','),
      difficulty: effectiveDifficulty,
      count: String(count),
    })
    router.push(`/${userId}/french/quiz?${p.toString()}`)
  }

  const canStart = selectedVerbs.length > 0 && selectedTenses.length > 0

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        {/* Nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/${userId}`} className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors">
            ← Matières
          </Link>
          <span className="text-gray-200">|</span>
          <span className="text-sm font-bold text-primary">Français</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary">Français</h1>
            <p className="text-gray-500 text-sm mt-0.5">Conjugaison des verbes</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Link href={`/${userId}/checks`} className="text-sm font-semibold text-amber-800 border border-amber-300 rounded-xl px-4 py-2 bg-amber-50 hover:bg-amber-100 transition-colors">
              Chèques
            </Link>
            <Link href={`/${userId}/progress`} className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors">
              Progrès →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-extrabold text-primary text-base">Dashboard conjugaison</h2>
              <p className="text-gray-400 text-sm mt-0.5">Carte verbes × temps, stats et sessions</p>
            </div>
            <Link
              href={`/${userId}/french/dashboard`}
              className="shrink-0 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-light transition-colors shadow-sm text-center"
            >
              Ouvrir →
            </Link>
          </div>
        </div>

        {/* Tenses */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-primary text-lg">1. Temps</h2>
            <button onClick={() => setSelectedTenses(selectedTenses.length === ALL_TENSES.length ? [] : [...ALL_TENSES])} className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors">
              {selectedTenses.length === ALL_TENSES.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_TENSES.map(t => (
              <button
                key={t}
                onClick={() => toggleTense(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                  selectedTenses.includes(t)
                    ? 'border-accent bg-accent/10 text-primary'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Verbs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-primary text-lg">2. Verbes</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{selectedVerbs.length}/{ALL_VERBS.length}</span>
              <button onClick={() => setSelectedVerbs(selectedVerbs.length === ALL_VERBS.length ? [] : [...ALL_VERBS])} className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors">
                {selectedVerbs.length === ALL_VERBS.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <button onClick={() => setVerbsOpen(!verbsOpen)} className="text-xs font-semibold text-gray-400 hover:text-primary transition-colors">
                {verbsOpen ? '▲ Réduire' : '▼ Voir'}
              </button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={applyVerbes5PGroup}
              className="text-xs font-semibold text-primary border border-primary/30 rounded-full px-3 py-1.5 hover:bg-primary hover:text-white transition-colors"
            >
              Appliquer groupe Verbes 5P
            </button>
            <span className="text-xs text-gray-400">
              8 verbes essentiels + verbes en -er
            </span>
          </div>
          {verbsOpen && (
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_VERBS.map(v => (
                <button
                  key={v}
                  onClick={() => toggleVerb(v)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                    selectedVerbs.includes(v)
                      ? 'border-accent bg-accent/10 text-primary'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {!verbsOpen && (
            <p className="text-sm text-gray-500 mt-1">
              {selectedVerbs.length === ALL_VERBS.length
                ? 'Tous les verbes sélectionnés'
                : selectedVerbs.length === 0
                ? 'Aucun verbe sélectionné'
                : selectedVerbs.slice(0, 6).join(', ') + (selectedVerbs.length > 6 ? ` +${selectedVerbs.length - 6} autres` : '')}
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-4">3. Difficulté</h2>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTIES.map(d => {
              const isHardLocked = d.id === 'hard' && !canUseHardMode
              return (
                <button
                  key={d.id}
                  onClick={() => handleSetDifficulty(d.id)}
                  disabled={isHardLocked}
                  title={isHardLocked ? 'Nécessite ≥4 temps, ≥10 verbes et des verbes non encore maîtrisés' : undefined}
                  className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all ${
                    isHardLocked
                      ? 'border-gray-200 opacity-40 cursor-not-allowed'
                      : difficulty === d.id
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-gray-200 hover:border-accent/50'
                  }`}
                >
                  <span className="font-bold text-primary text-sm">{d.label}</span>
                  <span className={`text-xs font-bold ${
                    d.color === 'emerald' ? 'text-emerald-600' :
                    d.color === 'amber' ? 'text-amber-600' : 'text-rose-600'
                  }`}>{d.multiplier} pts</span>
                  <span className="text-xs text-gray-500 text-center leading-snug">{d.desc}</span>
                </button>
              )
            })}
          </div>
          {!canUseHardMode && (
            <p className="mt-3 text-xs text-gray-400 text-center">
              Mode difficile : sélectionne ≥4 temps, ≥10 verbes dont certains non encore maîtrisés.
            </p>
          )}
        </div>

        {/* Count */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-extrabold text-primary text-lg mb-4">4. Nombre de questions</h2>
          <div className="flex gap-3">
            {([10, 20, 'all'] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  count === n
                    ? 'border-accent bg-accent text-white shadow-sm'
                    : 'border-gray-200 text-primary hover:border-accent/50'
                }`}
              >
                {n === 'all' ? 'Tout' : n}
              </button>
            ))}
          </div>
          {count === 'all' && canStart && (
            <p className="text-sm text-gray-500 mt-3">
              Couverture complète de la sélection: toutes les combinaisons verbe × temps seront posées.
            </p>
          )}
        </div>

        <button
          onClick={startQuiz}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-extrabold text-xl transition-all ${
            canStart
              ? 'bg-primary text-white hover:bg-primary-light shadow-lg hover:shadow-xl hover:-translate-y-0.5'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Commencer →
        </button>
      </div>
    </div>
  )
}
