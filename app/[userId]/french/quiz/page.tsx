'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

interface FrenchQuestion {
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
}

interface QuizResult {
  verb: string
  tense: string
  pronoun: string
  correct_answer: string
  answer_given: string
  correct: boolean
}

const FRENCH_CHARS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ï', 'ô', 'ù', 'û', 'ü', 'ç', 'œ', 'æ']

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!;:'"()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function FrenchQuizPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const userId = params.userId as string

  const verbsParam = searchParams.get('verbs') || ''
  const tensesParam = searchParams.get('tenses') || ''
  const difficulty = searchParams.get('difficulty') || 'easy'
  const countParamRaw = searchParams.get('count') || '10'
  const countParam = countParamRaw === 'all' ? 'all' : parseInt(countParamRaw, 10)

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<FrenchQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<QuizResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [done, setDone] = useState(false)
  const [finalPoints, setFinalPoints] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  const [typingAnswer, setTypingAnswer] = useState('')
  const [typingResult, setTypingResult] = useState<{ correct: boolean; shown: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const verbs = verbsParam ? verbsParam.split(',') : []
    const tenses = tensesParam ? tensesParam.split(',') : []
    setLoadError('')
    fetch('/api/french/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId), verbs, tenses, count: countParam, difficulty }),
    })
      .then(async r => {
        if (!r.ok) throw new Error('Impossible de charger la session de conjugaison.')
        return r.json()
      })
      .then(data => {
        setSessionId(data.session_id)
        setQuestions(data.questions)
        startTimeRef.current = Date.now()
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Impossible de charger la session de conjugaison.'
        setQuestions([])
        setLoadError(message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && !done && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, loading, done])

  useEffect(() => {
    if (loading || done) return
    const interval = setInterval(() => {
      if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [loading, done])

  useEffect(() => {
    if (done || loading) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, loading])

  function formatTime(s: number): string {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  const current = questions[currentIndex]

  function insertChar(char: string) {
    if (!inputRef.current) return
    const start = inputRef.current.selectionStart ?? typingAnswer.length
    const end = inputRef.current.selectionEnd ?? typingAnswer.length
    const newVal = typingAnswer.slice(0, start) + char + typingAnswer.slice(end)
    setTypingAnswer(newVal)
    setTimeout(() => {
      inputRef.current?.setSelectionRange(start + 1, start + 1)
      inputRef.current?.focus()
    }, 0)
  }

  async function saveResult(q: FrenchQuestion, answerGiven: string, isCorrect: boolean) {
    await fetch('/api/french/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: parseInt(userId),
        session_id: sessionId,
        verb: q.verb,
        tense: q.tense,
        pronoun: q.pronoun,
        correct_answer: q.correct_answer,
        answer_given: answerGiven,
        is_correct: isCorrect,
      }),
    })
  }

  function handleSubmit() {
    if (typingResult?.shown) {
      advance()
      return
    }
    if (!typingAnswer.trim()) return
    const norm = normalizeAnswer(typingAnswer)
    const expected = normalizeAnswer(current.correct_answer)
    const correct = norm === expected
    setTypingResult({ correct, shown: true })
    saveResult(current, typingAnswer.trim(), correct)
    setResults(prev => [...prev, {
      verb: current.verb,
      tense: current.tense,
      pronoun: current.pronoun,
      correct_answer: current.correct_answer,
      answer_given: typingAnswer.trim(),
      correct,
    }])
  }

  async function advance() {
    if (currentIndex + 1 >= questions.length) {
      const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0
      setElapsed(duration)
      const correct = results.filter(r => r.correct).length + (typingResult?.correct ? 0 : 0)
      const correctCount = results.filter(r => r.correct).length
      if (sessionId !== null) {
        const resp = await fetch('/api/french/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: parseInt(userId),
            session_id: sessionId,
            correct_count: correctCount,
            total_count: questions.length,
          }),
        })
        const data = await resp.json()
        setFinalPoints(data.points ?? null)
      }
      setDone(true)
    } else {
      setCurrentIndex(i => i + 1)
      setTypingAnswer('')
      setTypingResult(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function restart() {
    setCurrentIndex(0)
    setResults([])
    setDone(false)
    setTypingAnswer('')
    setTypingResult(null)
    setElapsed(0)
    setFinalPoints(null)
    startTimeRef.current = null
    setLoading(true)
    const verbs = verbsParam ? verbsParam.split(',') : []
    const tenses = tensesParam ? tensesParam.split(',') : []
    fetch('/api/french/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId), verbs, tenses, count: countParam, difficulty }),
    })
      .then(r => r.json())
      .then(data => {
        setSessionId(data.session_id)
        setQuestions(data.questions)
        setLoading(false)
        startTimeRef.current = Date.now()
      })
  }

  const correctCount = results.filter(r => r.correct).length
  const missedItems = results.filter(r => !r.correct)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-400 text-lg">Chargement…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-extrabold text-primary mb-2">Erreur de chargement</h2>
          <p className="text-gray-500 mb-5">{loadError}</p>
          <button
            onClick={() => router.push(`/${userId}/french`)}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
          >
            Retour au menu
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    const pct = Math.round((correctCount / questions.length) * 100)
    const emoji = correctCount === questions.length ? '🎉' : pct >= 70 ? '👍' : '💪'
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center mb-6">
            <div className="text-5xl mb-4">{emoji}</div>
            <h2 className="text-3xl font-extrabold text-primary mb-1">
              {correctCount} / {questions.length}
            </h2>
            <p className="text-gray-500 font-medium">
              {correctCount === questions.length ? 'Parfait !' : 'Continue comme ça !'}
            </p>
            <p className="text-sm text-gray-400 mt-3">⏱ {formatTime(elapsed)}</p>
          </div>

          {finalPoints !== null && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">Points (cette série)</p>
              <ul className="space-y-1 text-sm text-amber-950">
                <li>
                  Règle conjugaison :{' '}
                  <span className="font-semibold">
                    {correctCount} bonne{correctCount !== 1 ? 's' : ''} réponse{correctCount !== 1 ? 's' : ''} · {finalPoints} pt{finalPoints !== 1 ? 's' : ''}
                  </span>
                </li>
                <li className="pt-2 mt-2 border-t border-amber-200/80 font-extrabold text-lg text-primary">
                  Total cette série : +{finalPoints} pt{finalPoints !== 1 ? 's' : ''}
                </li>
              </ul>
            </div>
          )}

          {missedItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
              <h3 className="font-extrabold text-primary mb-3">À retravailler</h3>
              <div className="space-y-2">
                {missedItems.map((r, i) => (
                  <div key={i} className="text-sm p-2 rounded-lg bg-rose-50">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-gray-600">
                        <span className="font-semibold text-rose-700">{r.verb}</span>
                        {' · '}{r.tense}{' · '}{r.pronoun}
                      </span>
                      <span className="font-semibold text-primary">{r.correct_answer}</span>
                    </div>
                    {r.answer_given && (
                      <p className="text-xs text-gray-400 mt-0.5 line-through">{r.answer_given}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={restart} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors">
              Recommencer
            </button>
            <button onClick={() => router.push(`/${userId}/french`)} className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-bold hover:bg-primary/5 transition-colors">
              Retour au menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push(`/${userId}/french`)} className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors">
            ← Menu
          </button>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Français — conjugaison</span>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm font-semibold text-gray-500 mb-1.5">
            <span>Question {currentIndex + 1} / {questions.length}</span>
            <span className="flex items-center gap-3">
              <span className="text-gray-400 font-normal tabular-nums">⏱ {formatTime(elapsed)}</span>
              <span>{correctCount} correctes</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(currentIndex / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="flex-1 flex flex-col">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 mb-4">
            {/* Tense badge */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {current.tense}
              </span>
            </div>

            {/* Verb + pronoun */}
            <div className="text-center mb-6">
              <p className="text-4xl font-extrabold text-primary mb-2">{current.verb}</p>
              <p className="text-xl font-semibold text-gray-600">{current.pronoun} ___</p>
            </div>

            {/* Input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={typingAnswer}
                onChange={e => setTypingAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                readOnly={!!typingResult?.shown}
                placeholder="Conjugue le verbe…"
                className={`w-full border-2 rounded-xl px-4 py-3 text-primary font-semibold text-lg outline-none transition-colors text-center ${
                  typingResult?.shown
                    ? typingResult.correct
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-rose-400 bg-rose-50'
                    : 'border-gray-200 focus:border-accent'
                }`}
              />
            </div>

            {/* French chars */}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {FRENCH_CHARS.map(c => (
                <button
                  key={c}
                  onClick={() => insertChar(c)}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 hover:border-accent hover:bg-accent/10 font-semibold text-primary transition-colors text-sm"
                >
                  {c}
                </button>
              ))}
            </div>

            {typingResult?.shown && (
              <div className={`mt-4 p-3 rounded-xl text-sm font-semibold ${typingResult.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {typingResult.correct ? '✅ Correct !' : `❌ La bonne réponse : ${current.correct_answer}`}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!typingAnswer.trim() && !typingResult?.shown}
            className={`py-4 rounded-xl font-bold text-lg transition-all ${
              typingAnswer.trim() || typingResult?.shown
                ? 'bg-primary text-white hover:bg-primary-light shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {typingResult?.shown ? 'Suivant →' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
