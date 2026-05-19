'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SubjectPageHeader } from '@/components/SubjectPageHeader'

interface Verb {
  id: number
  unit: number
  infinitive: string
  french: string
  ich: string
  du: string
  er: string
  wir: string
  ihr: string
  sie: string
}

const PRONOUNS = ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie']
const FIELDS = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'] as const
type FieldKey = typeof FIELDS[number]

const SPECIAL_CHARS = ['à', 'â', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û']

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!;:'"()\-]/g, '')
    .replace(/\s+/g, '')
}

export default function VerbsPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [phase, setPhase] = useState<'config' | 'quiz' | 'done'>('config')
  const [count, setCount] = useState<5 | 10 | 'all'>(10)

  const [verbs, setVerbs] = useState<Verb[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<FieldKey, string>>({ ich: '', du: '', er: '', wir: '', ihr: '', sie: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sessionResults, setSessionResults] = useState<{ verb: Verb; correctCount: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const startTimeRef = useRef<number | null>(null)

  function startSession() {
    setLoading(true)
    const requestedCount = count === 'all' ? 999 : count
    fetch('/api/verbs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: requestedCount }),
    })
      .then(r => r.json())
      .then(data => {
        setVerbs(data)
        setCurrentIndex(0)
        setAnswers({ ich: '', du: '', er: '', wir: '', ihr: '', sie: '' })
        setSubmitted(false)
        setSessionResults([])
        startTimeRef.current = Date.now()
        setPhase('quiz')
        setLoading(false)
      })
  }

  useEffect(() => {
    if (phase === 'quiz' && !submitted) {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    }
  }, [currentIndex, phase, submitted])

  const current = verbs[currentIndex]

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>, fieldIndex: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (submitted) {
        advance()
      } else if (fieldIndex < 5) {
        inputRefs.current[fieldIndex + 1]?.focus()
      } else {
        handleSubmit()
      }
    }
  }

  function insertChar(char: string, fieldIndex: number) {
    const field = FIELDS[fieldIndex]
    const input = inputRefs.current[fieldIndex]
    if (!input) return
    const start = input.selectionStart ?? answers[field].length
    const end = input.selectionEnd ?? answers[field].length
    const newVal = answers[field].slice(0, start) + char + answers[field].slice(end)
    setAnswers(prev => ({ ...prev, [field]: newVal }))
    setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1)
      input.focus()
    }, 0)
  }

  async function handleSubmit() {
    if (submitted || !current) return
    setSubmitted(true)

    let correctCount = 0
    for (const field of FIELDS) {
      if (normalize(answers[field]) === normalize(current[field])) {
        correctCount++
      }
    }

    await fetch('/api/verbs/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId), verb_id: current.id, correct_count: correctCount }),
    })

    setSessionResults(prev => [...prev, { verb: current, correctCount }])
  }

  function advance() {
    if (currentIndex + 1 >= verbs.length) {
      const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0
      fetch('/api/verbs/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), verb_count: verbs.length, duration_seconds: duration }),
      }).catch(() => {})
      setPhase('done')
    } else {
      setCurrentIndex(i => i + 1)
      setAnswers({ ich: '', du: '', er: '', wir: '', ihr: '', sie: '' })
      setSubmitted(false)
    }
  }

  function getFieldStatus(field: FieldKey): 'correct' | 'incorrect' | 'pending' {
    if (!submitted) return 'pending'
    return normalize(answers[field]) === normalize(current[field]) ? 'correct' : 'incorrect'
  }

  const totalCorrectForms = sessionResults.reduce((sum, r) => sum + r.correctCount, 0)
  const totalForms = sessionResults.length * 6
  const perfectVerbs = sessionResults.filter(r => r.correctCount === 6).length

  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-xl mx-auto">
          <SubjectPageHeader
            userId={userId}
            subject="Conjugaison"
            subtitle="Écris les 6 formes conjuguées"
            backHref={`/${userId}/german`}
            backLabel="← Allemand"
            showChecks={false}
            progressHref={`/${userId}/progress?branch=allemand`}
          />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            <h2 className="font-extrabold text-primary text-lg mb-4">Nombre de verbes</h2>
            <div className="flex gap-3">
              {([5, 10, 'all'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                    count === n ? 'border-accent bg-accent text-white shadow-sm' : 'border-gray-200 text-primary hover:border-accent/50'
                  }`}
                >
                  {n === 'all' ? 'Tous' : n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-extrabold text-xl bg-primary text-white hover:bg-primary-light shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            {loading ? 'Chargement…' : 'Commencer →'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const missed = sessionResults.filter(r => r.correctCount < 6)
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center mb-6">
            <div className="text-5xl mb-4">{perfectVerbs === verbs.length ? '🎉' : perfectVerbs >= verbs.length * 0.7 ? '👍' : '💪'}</div>
            <h2 className="text-3xl font-extrabold text-primary mb-1">{totalCorrectForms} / {totalForms} formes</h2>
            <p className="text-gray-500 font-medium">{perfectVerbs} verbe{perfectVerbs !== 1 ? 's' : ''} parfait{perfectVerbs !== 1 ? 's' : ''} sur {verbs.length}</p>
          </div>

          {missed.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
              <h3 className="font-extrabold text-primary mb-4">Verbes à revoir</h3>
              <div className="space-y-4">
                {missed.map(({ verb, correctCount }) => (
                  <div key={verb.id} className="p-3 rounded-xl bg-rose-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-primary">{verb.infinitive}</span>
                      <span className="text-xs text-rose-500 font-semibold">{correctCount}/6 formes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      {FIELDS.map((f, i) => (
                        <span key={f}><span className="text-gray-400">{PRONOUNS[i].split(' ')[0]}</span> {verb[f]}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setPhase('config') }} className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-bold hover:bg-primary/5 transition-colors">
              Recommencer
            </button>
            <button onClick={() => router.push(`/${userId}/german`)} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors">
              Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null

  const allCorrect = submitted && FIELDS.every(f => getFieldStatus(f) === 'correct')

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push(`/${userId}/german`)} className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors">← Menu</button>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Conjugaison</span>
        </div>

        <div className="mb-5">
          <div className="flex justify-between text-sm font-semibold text-gray-500 mb-1.5">
            <span>Verbe {currentIndex + 1} / {verbs.length}</span>
            <span>{sessionResults.filter(r => r.correctCount === 6).length} parfaits</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(currentIndex / verbs.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-4">
          <div className="text-center mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Infinitif</p>
            <p className="text-3xl font-extrabold text-primary">{current.infinitive}</p>
            <p className="text-gray-400 font-medium mt-1">{current.french}</p>
          </div>

          <div className="space-y-2.5">
            {FIELDS.map((field, i) => {
              const status = getFieldStatus(field)
              return (
                <div key={field} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-semibold text-gray-400 text-right flex-shrink-0">{PRONOUNS[i]}</span>
                  <div className="flex-1 relative">
                    <input
                      ref={el => { inputRefs.current[i] = el }}
                      type="text"
                      value={answers[field]}
                      onChange={e => setAnswers(prev => ({ ...prev, [field]: e.target.value }))}
                      onKeyDown={e => handleInputKey(e, i)}
                      onFocus={() => setFocusedField(i)}
                      readOnly={submitted}
                      placeholder={`forme pour ${PRONOUNS[i].split(' ')[0]}…`}
                      className={`w-full border-2 rounded-xl px-3 py-2 text-primary font-semibold outline-none transition-colors text-sm ${
                        status === 'correct'
                          ? 'border-emerald-400 bg-emerald-50'
                          : status === 'incorrect'
                          ? 'border-rose-400 bg-rose-50'
                          : 'border-gray-200 focus:border-accent'
                      }`}
                    />
                    {status === 'incorrect' && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5 ml-1">→ {current[field]}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-1.5 mt-4 flex-wrap">
            {SPECIAL_CHARS.map(c => (
              <button
                key={c}
                onMouseDown={e => { e.preventDefault(); insertChar(c, focusedField) }}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 hover:border-accent hover:bg-accent/10 font-semibold text-primary transition-colors text-sm"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {submitted && (
          <div className={`rounded-xl p-3 text-center font-bold mb-4 ${allCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {allCorrect ? '🎉 Parfait ! Toutes les formes sont correctes.' : `${sessionResults[sessionResults.length - 1]?.correctCount ?? 0} / 6 formes correctes`}
          </div>
        )}

        {!submitted ? (
          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl font-bold text-lg bg-primary text-white hover:bg-primary-light transition-colors shadow-md"
          >
            Vérifier <span className="text-white/50 text-sm font-normal">[Entrée]</span>
          </button>
        ) : (
          <button
            onClick={advance}
            className="w-full py-4 rounded-xl font-bold text-lg bg-primary text-white hover:bg-primary-light transition-colors shadow-md"
          >
            {currentIndex + 1 >= verbs.length ? 'Voir les résultats →' : 'Suivant →'} <span className="text-white/50 text-sm font-normal">[Entrée]</span>
          </button>
        )}
      </div>
    </div>
  )
}
