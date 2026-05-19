'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SmartModeExplainer } from '@/components/SmartModeExplainer'
import { SmartSelectionPreview } from '@/components/SmartSelectionPreview'

type TablesMode = 'flashcard' | 'audio' | 'typing'

const TABLE_NUMBERS = Array.from({ length: 11 }, (_, i) => i + 2)

export default function TablesSetupPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [selectedTables, setSelectedTables] = useState<Set<number>>(
    () => new Set(TABLE_NUMBERS)
  )
  const [mode, setMode] = useState<TablesMode>('typing')
  const [count, setCount] = useState<10 | 20 | 'all'>(10)
  const [smartMode, setSmartMode] = useState(true)
  const [smartExplainBump, setSmartExplainBump] = useState(0)
  const [timerEnabled, setTimerEnabled] = useState(false)

  const toggleTable = useCallback((n: number) => {
    setSelectedTables(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }, [])

  const selectAllTables = useCallback(() => setSelectedTables(new Set(TABLE_NUMBERS)), [])
  const selectNoTables = useCallback(() => setSelectedTables(new Set()), [])

  const canStart = selectedTables.size > 0

  const sortedSelection = useMemo(
    () => [...selectedTables].sort((a, b) => a - b),
    [selectedTables]
  )

  const modeCards = useMemo(
    () => [
      { id: 'typing' as const, emoji: '⌨️', label: 'Frappe', desc: 'Écris le résultat' },
      { id: 'flashcard' as const, emoji: '🃏', label: 'Flashcards', desc: 'Retourne puis auto-évalue' },
      { id: 'audio' as const, emoji: '🎤', label: 'Audio', desc: 'Réponds en parlant' },
    ],
    []
  )

  function startSession() {
    if (!canStart) return
    // Unlock speechSynthesis in the user-gesture context so it works on the quiz page
    if (mode === 'audio' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
    }
    const query = new URLSearchParams({
      mode,
      count: String(count),
      timer: timerEnabled ? '1' : '0',
      tables: sortedSelection.join(','),
      smart: smartMode ? '1' : '0',
    })
    router.push(`/${userId}/tables/quiz?${query.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 mb-4">
          <Link
            href={`/${userId}/german`}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
          >
            Allemand
          </Link>
          <span className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white">
            Math
          </span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary">Math</h1>
            <p className="text-gray-500 text-sm mt-0.5">Tables de multiplication</p>
          </div>
          <Link
            href={`/${userId}/math`}
            className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors"
          >
            ← Exercices math
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-extrabold text-primary text-lg">1. Tables incluses</h2>
              <p className="text-sm text-gray-500 mt-1">
                Pour chaque table choisie : <span className="font-semibold text-primary">n × 2</span> jusqu’à{' '}
                <span className="font-semibold text-primary">n × 12</span>.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={selectAllTables}
                className="text-xs font-bold text-primary underline-offset-2 hover:underline"
              >
                Tout
              </button>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={selectNoTables}
                className="text-xs font-bold text-gray-500 underline-offset-2 hover:underline"
              >
                Aucune
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {TABLE_NUMBERS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => toggleTable(n)}
                className={`aspect-square rounded-xl border-2 text-lg font-extrabold transition-all ${
                  selectedTables.has(n)
                    ? 'border-accent bg-accent text-white shadow-sm'
                    : 'border-gray-200 text-gray-400 hover:border-accent/40'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {!canStart ? (
            <p className="text-sm text-rose-600 font-medium mt-3">Choisis au moins une table pour commencer.</p>
          ) : sortedSelection.length < 11 ? (
            <p className="text-sm text-gray-500 mt-3">
              Tables :{' '}
              <span className="font-semibold text-primary">{sortedSelection.join(', ')}</span> —{' '}
              {sortedSelection.length} table{sortedSelection.length !== 1 ? 's' : ''}, jusqu’à{' '}
              {sortedSelection.length * 11} tirages possibles avant répétition.
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-3">Tables 2 à 12 — même couverture qu’une grille complète.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-4">2. Choisir le mode</h2>
          <div className="grid grid-cols-3 gap-3">
            {modeCards.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === m.id ? 'border-accent bg-accent/10 shadow-sm' : 'border-gray-200 hover:border-accent/50'
                }`}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="font-bold text-primary text-sm">{m.label}</span>
                <span className="text-xs text-gray-500 text-center leading-snug">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-3">3. Révision intelligente</h2>
          <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-gray-200 px-4 py-3 hover:border-accent/40">
            <input
              type="checkbox"
              checked={smartMode}
              onChange={e => {
                const v = e.target.checked
                setSmartMode(v)
                if (v) setSmartExplainBump(k => k + 1)
              }}
              className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
            />
            <div className="min-w-0">
              <p className="font-bold text-primary">Mode intelligent</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Mets le poids sur les multiplications encore faibles ou peu vues depuis longtemps. Désactive pour un tirage
                équitable parmi tes tables choisies.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Ouvre « Objectif & priorités » en dessous pour voir les règles exactes, avant comme après avoir coché.
              </p>
            </div>
          </label>
          <SmartModeExplainer
            variant="tables"
            revealKey={smartExplainBump}
            preview={
              <SmartSelectionPreview
                variant="tables"
                userId={userId}
                tables={sortedSelection}
                mode={mode}
                count={count}
                smart={smartMode}
              />
            }
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-4">4. Nombre de questions</h2>
          <div className="flex gap-3">
            {([10, 20, 'all'] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  count === n ? 'border-accent bg-accent text-white shadow-sm' : 'border-gray-200 text-primary hover:border-accent/50'
                }`}
              >
                {n === 'all' ? 'Tout' : n}
              </button>
            ))}
          </div>
          {count === 'all' && canStart && (
            <p className="text-sm text-gray-500 mt-3">
              Couverture complète: <span className="font-semibold text-primary">{sortedSelection.length * 11}</span>{' '}
              question{sortedSelection.length * 11 !== 1 ? 's' : ''} (×2 à ×12 par table sélectionnée).
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-extrabold text-primary text-lg mb-3">5. Chrono optionnel</h2>
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:border-accent/50">
            <div>
              <p className="font-semibold text-primary">Timer 5 secondes</p>
              <p className="text-xs text-gray-500">Sans réponse sous 5s, la question est comptée fausse</p>
            </div>
            <input
              type="checkbox"
              checked={timerEnabled}
              onChange={e => setTimerEnabled(e.target.checked)}
              className="h-5 w-5 accent-amber-500"
            />
          </label>
        </div>

        <button
          onClick={startSession}
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
