'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SmartModeExplainer } from '@/components/SmartModeExplainer'
import { SmartSelectionPreview } from '@/components/SmartSelectionPreview'
import { SubjectPageHeader } from '@/components/SubjectPageHeader'
import { UnitVocabPractice } from '@/components/UnitVocabPractice'

interface VocabUnit {
  unit: number
  unit_title: string
  count: number
}

export default function EnglishHubPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()

  const [units, setUnits] = useState<VocabUnit[]>([])
  const [selectedUnits, setSelectedUnits] = useState<number[]>([])
  const [mode, setMode] = useState<'flashcard' | 'audio' | 'typing'>('typing')
  const [count, setCount] = useState<10 | 20 | 'all'>(10)
  const [smartMode, setSmartMode] = useState(true)
  const [smartExplainBump, setSmartExplainBump] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/english/units')
      .then(r => r.json())
      .then((data: VocabUnit[]) => {
        setUnits(data)
        setLoading(false)
      })
  }, [])

  function toggleUnit(unit: number) {
    setSelectedUnits(prev =>
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    )
  }

  function toggleAll() {
    if (selectedUnits.length === units.length) setSelectedUnits([])
    else setSelectedUnits(units.map(u => u.unit))
  }

  function startQuiz() {
    if (!mode || selectedUnits.length === 0) return
    const p = new URLSearchParams({
      units: selectedUnits.join(','),
      mode,
      count: String(count),
      smart: smartMode ? '1' : '0',
    })
    router.push(`/${userId}/english/quiz?${p.toString()}`)
  }

  const canStart = selectedUnits.length > 0
  const selectedWordCount = units
    .filter(u => selectedUnits.includes(u.unit))
    .reduce((sum, u) => sum + u.count, 0)

  const modes = [
    { id: 'typing', emoji: '⌨️', label: 'Frappe', desc: 'Écris la réponse en anglais' },
    { id: 'flashcard', emoji: '🃏', label: 'Flashcards', desc: 'Retourne la carte et dis si tu savais' },
    { id: 'audio', emoji: '🎤', label: 'Audio', desc: 'Écoute et réponds à voix haute' },
  ] as const

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <SubjectPageHeader
          userId={userId}
          subject="Anglais"
          subtitle="Prépare ta session d'anglais"
          progressHref={`/${userId}/progress?branch=english`}
          progressLabel="Mes progrès →"
        />

        {/* Units */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-primary text-lg">1. Choisir les unités</h2>
            {units.length > 0 && (
              <button onClick={toggleAll} className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors">
                {selectedUnits.length === units.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : (
            <div className="space-y-2">
              {units.map(u => (
                <div
                  key={u.unit}
                  className={`flex flex-col gap-2 rounded-xl border-2 p-3 transition-all sm:flex-row sm:items-center ${
                    selectedUnits.includes(u.unit) ? 'border-accent bg-accent/5' : 'border-transparent hover:border-gray-200'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedUnits.includes(u.unit)}
                      onChange={() => toggleUnit(u.unit)}
                      className="h-4 w-4 shrink-0 accent-amber-500"
                    />
                    <span className="font-semibold text-primary">Unité {u.unit}</span>
                    <span className="truncate text-sm text-gray-500">– {u.unit_title}</span>
                    <span className="ml-auto shrink-0 text-xs text-gray-400">{u.count} mots</span>
                  </label>
                  <div className="flex shrink-0 justify-end border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0">
                    <UnitVocabPractice userId={userId} unit={u.unit} label={false} compact subject="english" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-3">2. Révision intelligente</h2>
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
                Priorité aux mots jamais vus ou mal connus (et à ceux que tu n'as pas revus depuis longtemps). Désactive
                pour tirer au hasard parmi tes unités comme avant.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Ouvre « Objectif & priorités » en dessous pour voir les règles exactes, avant comme après avoir coché.
              </p>
            </div>
          </label>
          <SmartModeExplainer
            variant="english"
            revealKey={smartExplainBump}
            preview={
              <SmartSelectionPreview
                variant="english"
                userId={userId}
                units={selectedUnits}
                mode={mode}
                count={count}
                smart={smartMode}
              />
            }
          />
        </div>

        {/* Mode */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-4">3. Choisir le mode</h2>
          <div className="grid grid-cols-3 gap-3">
            {modes.map(m => (
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

        {/* Count */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
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
          {count === 'all' && selectedUnits.length > 0 && (
            <p className="text-sm text-gray-500 mt-3">
              Couverture complète: <span className="font-semibold text-primary">{selectedWordCount}</span> mot
              {selectedWordCount !== 1 ? 's' : ''} (sans répétition).
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
