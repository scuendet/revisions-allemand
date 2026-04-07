'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface VocabUnit {
  unit: number
  unit_title: string
  count: number
}

export default function DashboardPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()

  const [units, setUnits] = useState<VocabUnit[]>([])
  const [selectedUnits, setSelectedUnits] = useState<number[]>([])
  const [mode, setMode] = useState<'flashcard' | 'audio' | 'typing' | null>(null)
  const [count, setCount] = useState<10 | 20>(10)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/units')
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
    if (selectedUnits.length === units.length) {
      setSelectedUnits([])
    } else {
      setSelectedUnits(units.map(u => u.unit))
    }
  }

  function startQuiz() {
    if (!mode || selectedUnits.length === 0) return
    const params = new URLSearchParams({
      units: selectedUnits.join(','),
      mode,
      count: String(count),
    })
    router.push(`/${userId}/quiz?${params.toString()}`)
  }

  const canStart = mode !== null && selectedUnits.length > 0

  const modes = [
    { id: 'flashcard', emoji: '🃏', label: 'Flashcards', desc: 'Retourne la carte et dis si tu savais' },
    { id: 'audio', emoji: '🎤', label: 'Audio', desc: 'Écoute et réponds à voix haute' },
    { id: 'typing', emoji: '⌨️', label: 'Frappe', desc: 'Écris la réponse en allemand' },
  ] as const

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary">Deutsch Üben</h1>
            <p className="text-gray-500 text-sm mt-0.5">Prépare ta session</p>
          </div>
          <Link
            href={`/${userId}/progress`}
            className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors"
          >
            Mes progrès →
          </Link>
        </div>

        {/* Step 1: Units */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-primary text-lg">1. Choisir les unités</h2>
            {units.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors"
              >
                {selectedUnits.length === units.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : (
            <div className="space-y-2">
              {units.map(u => (
                <label
                  key={u.unit}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${
                    selectedUnits.includes(u.unit)
                      ? 'border-accent bg-accent/5'
                      : 'border-transparent hover:border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUnits.includes(u.unit)}
                    onChange={() => toggleUnit(u.unit)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="font-semibold text-primary">
                    Unité {u.unit}
                  </span>
                  <span className="text-gray-500 text-sm">– {u.unit_title}</span>
                  <span className="ml-auto text-xs text-gray-400">{u.count} mots</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Mode */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="font-extrabold text-primary text-lg mb-4">2. Choisir le mode</h2>
          <div className="grid grid-cols-3 gap-3">
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  mode === m.id
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-gray-200 hover:border-accent/50'
                }`}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="font-bold text-primary text-sm">{m.label}</span>
                <span className="text-xs text-gray-500 text-center leading-snug">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Count */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="font-extrabold text-primary text-lg mb-4">3. Nombre de questions</h2>
          <div className="flex gap-3">
            {([10, 20] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  count === n
                    ? 'border-accent bg-accent text-white shadow-sm'
                    : 'border-gray-200 text-primary hover:border-accent/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Verb conjugation shortcut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-primary text-base">🔀 Conjugaison des verbes</h2>
              <p className="text-gray-400 text-sm mt-0.5">Écris les 6 formes conjuguées</p>
            </div>
            <a
              href={`/${userId}/verbs`}
              className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-light transition-colors shadow-sm whitespace-nowrap"
            >
              Pratiquer →
            </a>
          </div>
        </div>

        {/* Start button */}
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
