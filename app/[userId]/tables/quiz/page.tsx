'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MATH_PERFECT_SESSION_BONUS } from '@/lib/checksConfig'

type TablesMode = 'flashcard' | 'audio' | 'typing'

interface TableQuestion {
  id: string
  left: number
  right: number
  answer: number
}

interface AttemptResult {
  questionId: string
  correct: boolean
  left: number
  right: number
  answer: number
}

const ADVANCE_MS_AFTER_CORRECT = 300
const ADVANCE_MS_AFTER_WRONG = 3000

function parseSpokenNumber(value: string): number | null {
  const cleaned = value.trim().toLowerCase()
  const digits = cleaned.replace(/[^0-9-]/g, '')
  if (digits && /^-?\d+$/.test(digits)) return Number(digits)
  const words: Record<string, number> = {
    zero: 0,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
    soixante_dix: 70,
    quatre_vingt: 80,
    quatre_vingt_dix: 90,
  }
  const key = cleaned.replace(/[-\s]+/g, '_')
  return words[key] ?? null
}

export default function TablesQuizPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = Number(params.userId as string)

  const mode = (searchParams.get('mode') || 'typing') as TablesMode
  const timerEnabled = searchParams.get('timer') === '1'
  const countParamRaw = searchParams.get('count') || '10'
  const count = countParamRaw === 'all' ? 'all' : Number(countParamRaw)
  const smartMode = searchParams.get('smart') !== '0'

  const tablesParamKey = searchParams.get('tables') ?? ''
  const tablesSelection = useMemo(() => {
    if (!tablesParamKey.trim()) {
      return Array.from({ length: 11 }, (_, i) => i + 2)
    }
    const set = new Set<number>()
    for (const part of tablesParamKey.split(',')) {
      const n = parseInt(part.trim(), 10)
      if (Number.isInteger(n) && n >= 2 && n <= 12) set.add(n)
    }
    return set.size > 0 ? [...set].sort((a, b) => a - b) : Array.from({ length: 11 }, (_, i) => i + 2)
  }, [tablesParamKey])

  const [sessionKey, setSessionKey] = useState(0)
  const [items, setItems] = useState<TableQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [done, setDone] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<AttemptResult[]>([])
  /** Toujours aligné avec le dernier essai — évite un décalage sur la dernière question (setTimeout + state). */
  const resultsRef = useRef<AttemptResult[]>([])
  const [lastSessionPoints, setLastSessionPoints] = useState<{
    base: number
    timerDoubled: boolean
    bonus: number
    total: number
  } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [remainingMs, setRemainingMs] = useState(5000)
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const answeredRef = useRef(false)
  const [timeoutShake, setTimeoutShake] = useState(false)

  const [flipped, setFlipped] = useState(false)
  const [typingAnswer, setTypingAnswer] = useState('')
  const [typingResult, setTypingResult] = useState<boolean | null>(null)
  const [recording, setRecording] = useState(false)
  const [audioTranscript, setAudioTranscript] = useState('')
  const [audioResult, setAudioResult] = useState<boolean | null>(null)
  const [audioError, setAudioError] = useState('')
  const recognitionRef = useRef<any>(null)
  const tablesAudioGenRef = useRef(0)
  /** Chrome peut ignorer speak() juste après cancel() — on reporte. */
  const tablesDeferredSpeakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tablesPostListenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tablesRecognitionListeningRef = useRef(false)
  const tablesQuestionRef = useRef<TableQuestion | null>(null)
  const frVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const current = items[currentIndex]
  const correctCount = results.filter(r => r.correct).length

  const doneRef = useRef(done)
  doneRef.current = done

  useEffect(() => {
    function pickVoice() {
      const voices = window.speechSynthesis.getVoices()
      const thomas = voices.find(v => v.name === 'Thomas')
      frVoiceRef.current = thomas ?? voices.find(v => v.lang.startsWith('fr')) ?? null
    }
    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [])

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    setDone(false)
    setCurrentIndex(0)
    answeredRef.current = false
    fetch('/api/tables/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count,
        tables: tablesSelection,
        user_id: userId,
        mode,
        smart: smartMode,
      }),
    })
      .then(async r => {
        if (!r.ok) throw new Error('Impossible de charger la session de tables.')
        return r.json()
      })
      .then(data => {
        setItems(Array.isArray(data) ? data : [])
        resultsRef.current = []
        setResults([])
        setLastSessionPoints(null)
        startTimeRef.current = Date.now()
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Impossible de charger la session de tables.'
        setItems([])
        setLoadError(message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [count, tablesSelection, userId, mode, smartMode, sessionKey])

  useEffect(() => {
    tablesQuestionRef.current = current ?? null
  }, [current])

  useEffect(() => {
    if (loading || done) return
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [loading, done])

  useEffect(() => {
    if (!timerEnabled || loading || done || !current) {
      setQuestionDeadline(null)
      setRemainingMs(5000)
      return
    }
    answeredRef.current = false
    const deadline = Date.now() + 5000
    setQuestionDeadline(deadline)
    setRemainingMs(5000)
  }, [timerEnabled, loading, done, currentIndex, current, mode])

  useEffect(() => {
    if (mode !== 'audio') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      if (answeredRef.current) return
      if (tablesRecognitionListeningRef.current) {
        // Already recording — stop mic (answer will be processed on stop)
        recognitionRef.current?.stop()
      } else {
        // Speak the question (direct user gesture — works in Chrome) then open mic
        const q = tablesQuestionRef.current
        if (q && window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const utter = makeUtterance(`${q.left} fois ${q.right}`)
          utter.onend = () => { if (!answeredRef.current) startAudio() }
          utter.onerror = () => { if (!answeredRef.current) startAudio() }
          window.speechSynthesis.speak(utter)
        } else {
          startAudio()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  useEffect(() => {
    if (!timerEnabled || !questionDeadline || done || loading) return
    const interval = setInterval(() => {
      const remaining = questionDeadline - Date.now()
      setRemainingMs(Math.max(0, remaining))
      if (remaining <= 0 && !answeredRef.current) {
        if (mode === 'audio') {
          if (tablesDeferredSpeakTimeoutRef.current !== null) {
            clearTimeout(tablesDeferredSpeakTimeoutRef.current)
            tablesDeferredSpeakTimeoutRef.current = null
          }
          if (tablesPostListenTimeoutRef.current !== null) {
            clearTimeout(tablesPostListenTimeoutRef.current)
            tablesPostListenTimeoutRef.current = null
          }
          window.speechSynthesis.cancel()
          if (recording) {
            recognitionRef.current?.stop()
            setRecording(false)
          }
        }
        setTimeoutShake(true)
        if (mode === 'typing') {
          const typed = Number(typingAnswer.trim())
          const timedCorrect = Number.isFinite(typed) && !!current && typed === current.answer
          setTypingResult(timedCorrect)
          if (!timedCorrect) {
            setAudioError('Temps écoulé (5s).')
          }
          markAnswer(timedCorrect)
        } else if (mode === 'audio') {
          const spoken = parseSpokenNumber(audioTranscript)
          const timedCorrect = spoken !== null && !!current && spoken === current.answer
          setAudioResult(timedCorrect)
          if (!timedCorrect) {
            setAudioError('Temps écoulé (5s).')
          }
          markAnswer(timedCorrect)
        } else {
          setAudioError('Temps écoulé (5s).')
          markAnswer(false)
        }
      }
    }, 100)
    return () => clearInterval(interval)
  }, [timerEnabled, questionDeadline, mode, done, loading, recording, typingAnswer, current, audioTranscript])

  async function saveResult(correct: boolean) {
    if (!current) return
    await fetch('/api/tables/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        left: current.left,
        right: current.right,
        expected_answer: current.answer,
        mode,
        timer_enabled: timerEnabled,
        correct,
      }),
    })
  }

  async function markAnswer(correct: boolean, delayMs?: number) {
    if (!current || answeredRef.current) return
    answeredRef.current = true
    try { await saveResult(correct) } catch { /* advance regardless */ }
    const row: AttemptResult = {
      questionId: current.id,
      correct,
      left: current.left,
      right: current.right,
      answer: current.answer,
    }
    resultsRef.current = [...resultsRef.current, row]
    setResults([...resultsRef.current])
    const ms = delayMs ?? (correct ? ADVANCE_MS_AFTER_CORRECT : ADVANCE_MS_AFTER_WRONG)
    setTimeout(() => advance(), ms)
  }

  function resetQuestionState() {
    answeredRef.current = false
    setFlipped(false)
    setTypingAnswer('')
    setTypingResult(null)
    setRecording(false)
    tablesRecognitionListeningRef.current = false
    setAudioTranscript('')
    setAudioResult(null)
    setAudioError('')
    setRemainingMs(5000)
    setTimeoutShake(false)
  }

  function advance() {
    if (currentIndex + 1 >= items.length) {
      finishSession()
      return
    }
    setCurrentIndex(i => i + 1)
    resetQuestionState()
  }

  function finishSession() {
    const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0
    const list = resultsRef.current
    const totalN = items.length
    const correctN = list.filter(r => r.correct).length
    const allPerfect = totalN > 0 && correctN === totalN
    const basePoints = Math.floor(correctN / 3)
    const effectiveBase = timerEnabled ? basePoints * 2 : basePoints
    const bonusPoints = allPerfect ? MATH_PERFECT_SESSION_BONUS : 0
    setLastSessionPoints({
      base: basePoints,
      timerDoubled: timerEnabled,
      bonus: bonusPoints,
      total: effectiveBase + bonusPoints,
    })
    setElapsed(duration)
    setDone(true)
    fetch('/api/tables/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        tables: tablesSelection,
        mode,
        timer_enabled: timerEnabled,
        duration_seconds: duration,
        all_correct_series: allPerfect,
      }),
    })
  }

  function submitTyping() {
    if (!current || answeredRef.current) return
    const answer = Number(typingAnswer.trim())
    if (!Number.isFinite(answer)) return
    const correct = answer === current.answer
    setTypingResult(correct)
    markAnswer(correct)
  }

  function makeUtterance(text: string): SpeechSynthesisUtterance {
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.9
    const voice = frVoiceRef.current
    if (voice) { utter.voice = voice; utter.lang = voice.lang }
    else utter.lang = 'fr-FR'
    return utter
  }

  function clearTablesPromptSchedule() {
    if (tablesDeferredSpeakTimeoutRef.current !== null) {
      clearTimeout(tablesDeferredSpeakTimeoutRef.current)
      tablesDeferredSpeakTimeoutRef.current = null
    }
    if (tablesPostListenTimeoutRef.current !== null) {
      clearTimeout(tablesPostListenTimeoutRef.current)
      tablesPostListenTimeoutRef.current = null
    }
    window.speechSynthesis.cancel()
    try {
      recognitionRef.current?.stop()
    } catch {
      recognitionRef.current?.abort?.()
    }
    tablesRecognitionListeningRef.current = false
  }

  function interruptTablesSynthAndScheduledListen() {
    tablesAudioGenRef.current += 1
    if (tablesDeferredSpeakTimeoutRef.current !== null) {
      clearTimeout(tablesDeferredSpeakTimeoutRef.current)
      tablesDeferredSpeakTimeoutRef.current = null
    }
    if (tablesPostListenTimeoutRef.current !== null) {
      clearTimeout(tablesPostListenTimeoutRef.current)
      tablesPostListenTimeoutRef.current = null
    }
    window.speechSynthesis.cancel()
  }

  function startAudio() {
    setAudioError('')
    const row = tablesQuestionRef.current
    if (!row) return
    if (tablesRecognitionListeningRef.current) return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setAudioError("La reconnaissance vocale n'est pas supportée ici. Essaie Chrome.")
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => {
      tablesRecognitionListeningRef.current = true
      setRecording(true)
    }
    recognition.onend = () => {
      tablesRecognitionListeningRef.current = false
      setRecording(false)
      // Auto-restart mic if question still unanswered
      if (!answeredRef.current && !doneRef.current) {
        setTimeout(() => {
          if (!answeredRef.current && !doneRef.current && !tablesRecognitionListeningRef.current) startAudio()
        }, 400)
      }
    }
    recognition.onerror = (e: any) => {
      tablesRecognitionListeningRef.current = false
      setAudioError(`Erreur micro: ${e.error}`)
      setRecording(false)
    }
    recognition.onresult = (e: { results: { 0: { transcript: string } }[] }) => {
      const q = tablesQuestionRef.current
      if (!q || answeredRef.current) return
      const transcript = e.results[0][0].transcript.trim()
      const parsed = parseSpokenNumber(transcript)
      setAudioTranscript(transcript)
      if (parsed === null) {
        setAudioError('Réponse non comprise. Réponds en chiffre (ex: 24).')
        return
      }
      const correct = parsed === q.answer
      setAudioResult(correct)
      markAnswer(correct)
    }
    recognition.start()
  }

  function speakTablesPromptThenListen() {
    const q = tablesQuestionRef.current
    if (!q) return
    tablesAudioGenRef.current += 1
    const myGen = tablesAudioGenRef.current
    clearTablesPromptSchedule()

    const doSpeak = () => {
      if (tablesAudioGenRef.current !== myGen || doneRef.current) return

      const utter = makeUtterance(`${q.left} fois ${q.right}`)

      const onDone = () => {
        if (tablesAudioGenRef.current !== myGen || doneRef.current) return
        startAudio()
      }
      utter.onend = onDone
      utter.onerror = onDone

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      // Voices already loaded — speak after minimal delay (Chrome cancel() quirk)
      tablesDeferredSpeakTimeoutRef.current = setTimeout(() => {
        tablesDeferredSpeakTimeoutRef.current = null
        doSpeak()
      }, 50)
    } else {
      // Voices not yet loaded — wait for voiceschanged then speak
      const onVoicesChanged = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
        tablesDeferredSpeakTimeoutRef.current = setTimeout(() => {
          tablesDeferredSpeakTimeoutRef.current = null
          doSpeak()
        }, 50)
      }
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
      // Fallback: if voiceschanged never fires, speak after 500ms without a specific voice
      tablesDeferredSpeakTimeoutRef.current = setTimeout(() => {
        tablesDeferredSpeakTimeoutRef.current = null
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
        doSpeak()
      }, 500)
    }
  }

  useEffect(() => {
    if (loading || mode !== 'audio' || done || !current) return
    let cancelled = false
    window.speechSynthesis.cancel()
    const speakT = setTimeout(() => {
      if (cancelled) return
      const utter = makeUtterance(`${current.left} fois ${current.right}`)
      utter.onend = () => { if (!cancelled && !answeredRef.current) startAudio() }
      utter.onerror = () => { if (!cancelled && !answeredRef.current) startAudio() }
      window.speechSynthesis.speak(utter)
    }, 50)
    // Fallback: if speech never fires onend/onerror, start mic after 2s
    const fallbackT = setTimeout(() => {
      if (!cancelled && !answeredRef.current && !tablesRecognitionListeningRef.current) startAudio()
    }, 2000)
    return () => {
      cancelled = true
      clearTimeout(speakT)
      clearTimeout(fallbackT)
      window.speechSynthesis.cancel()
    }
  }, [currentIndex, loading, mode, done, current?.id])

  function fmtTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function restart() {
    router.push(`/${userId}/tables`)
  }

  function restartSameSeries() {
    setSessionKey(k => k + 1)
  }

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
            onClick={restart}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
          >
            Retour à la configuration
          </button>
        </div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-extrabold text-primary mb-2">Aucune question disponible</h2>
          <p className="text-gray-500 mb-5">Vérifie les paramètres de tables et recommence.</p>
          <button
            onClick={restart}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
          >
            Retour à la configuration
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="text-5xl mb-4">{correctCount === items.length ? '🎉' : correctCount >= items.length * 0.7 ? '👍' : '💪'}</div>
          <h2 className="text-3xl font-extrabold text-primary mb-1">
            {correctCount} / {items.length}
          </h2>
          <p className="text-gray-500 font-medium mb-2">
            {correctCount === items.length ? 'Parfait !' : 'Continue comme ça !'}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            ⏱ {fmtTime(elapsed)} · {timerEnabled ? 'Timer 5s activé' : 'Sans timer'}
          </p>

          {lastSessionPoints !== null ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">Points (cette série)</p>
              <ul className="space-y-1 text-sm text-amber-950">
                <li>
                  Règle tables :{' '}
                  <span className="font-semibold">
                    {correctCount} bonne(s) réponse · {lastSessionPoints.base} pt
                    {lastSessionPoints.base !== 1 ? 's' : ''}
                  </span>{' '}
                  <span className="text-amber-800/90">(1 pt par 3 justes)</span>
                </li>
                {lastSessionPoints.timerDoubled ? (
                  <li className="font-semibold text-violet-700">
                    ⚡ Bonus timer 5s : ×2 → +{lastSessionPoints.base} pt{lastSessionPoints.base !== 1 ? 's' : ''} supplémentaires
                  </li>
                ) : null}
                {lastSessionPoints.bonus > 0 ? (
                  <li className="font-semibold text-emerald-700">
                    🌟 Bonus série parfaite : +{lastSessionPoints.bonus} pts
                  </li>
                ) : null}
                <li className="pt-2 mt-2 border-t border-amber-200/80 font-extrabold text-lg text-primary">
                  Total cette série : +{lastSessionPoints.total} pt{lastSessionPoints.total !== 1 ? 's' : ''}
                </li>
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              onClick={restartSameSeries}
              className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors"
            >
              Recommencer (mêmes paramètres)
            </button>
            <div className="flex gap-3">
              <button
                onClick={restart}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
              >
                Reconfigurer
              </button>
              <button
                onClick={() => router.push(`/${userId}/math`)}
                className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-bold hover:bg-primary/5 transition-colors"
              >
                Retour menu
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const timerSeconds = Math.ceil(remainingMs / 1000)

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 mb-4 w-fit">
          <Link
            href={`/${userId}/math`}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
          >
            Allemand
          </Link>
          <span className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white">
            Math
          </span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push(`/${userId}/tables`)}
            className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors"
          >
            ← Exercices math
          </button>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
            {mode === 'flashcard' ? '🃏 Flashcards' : mode === 'audio' ? '🎤 Audio' : '⌨️ Frappe'}
          </span>
        </div>

        <div className={`mb-6 ${timeoutShake ? 'animate-[timeoutshake_0.36s_ease-in-out_2]' : ''}`}>
          <div className="flex justify-between text-sm font-semibold text-gray-500 mb-1.5">
            <span>Question {currentIndex + 1} / {items.length}</span>
            <span className="flex items-center gap-3">
              {timerEnabled && <span className="text-rose-500">⏳ {timerSeconds}s</span>}
              <span className="text-gray-400 font-normal tabular-nums">⏱ {fmtTime(elapsed)}</span>
              <span>{correctCount} correctes</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(currentIndex / items.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 mb-4 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Calcule</p>
          <p className="text-4xl font-extrabold text-primary">
            {current.left} × {current.right}
          </p>
        </div>

        {mode === 'flashcard' && (
          <div className="flex-1 flex flex-col gap-3">
            {!flipped ? (
              <button
                onClick={() => setFlipped(true)}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-light transition-colors"
              >
                Afficher la réponse
              </button>
            ) : (
              <div className="bg-primary text-white rounded-2xl p-6 text-center shadow-sm">
                <p className="text-xs uppercase tracking-wide text-accent/90 mb-1">Réponse</p>
                <p className="text-4xl font-extrabold">{current.answer}</p>
              </div>
            )}

            {flipped && (
              <div className="flex gap-3">
                <button
                  onClick={() => markAnswer(false)}
                  className="flex-1 py-4 bg-rose-400 text-white rounded-xl font-bold text-lg hover:bg-rose-500 transition-colors shadow-sm"
                >
                  ❌ Je ne savais pas
                </button>
                <button
                  onClick={() => markAnswer(true)}
                  className="flex-1 py-4 bg-emerald-400 text-white rounded-xl font-bold text-lg hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  ✅ Je savais
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'typing' && (
          <div className="flex-1 flex flex-col">
            <input
              type="number"
              value={typingAnswer}
              onChange={e => setTypingAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitTyping()
              }}
              placeholder="Ta réponse…"
              className={`w-full border-2 rounded-xl px-4 py-4 text-primary font-semibold text-2xl text-center outline-none transition-colors mb-3 ${
                typingResult === null
                  ? 'border-gray-200 focus:border-accent'
                  : typingResult
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-rose-400 bg-rose-50'
              }`}
            />
            {typingResult === false ? (
              <p className="mb-3 text-lg font-bold text-rose-600">Réponse attendue : {current.answer}</p>
            ) : null}
            <button
              onClick={submitTyping}
              disabled={!typingAnswer.trim() || answeredRef.current}
              className={`py-4 rounded-xl font-bold text-lg transition-all ${
                typingAnswer.trim() && !answeredRef.current
                  ? 'bg-primary text-white hover:bg-primary-light shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Valider
            </button>
          </div>
        )}

        {mode === 'audio' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col items-center">
              <button
                type="button"
                disabled={answeredRef.current}
                onClick={
                  answeredRef.current
                    ? undefined
                    : recording
                      ? () => recognitionRef.current?.stop()
                      : () => {
                          interruptTablesSynthAndScheduledListen()
                          startAudio()
                        }
                }
                className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all ${
                  answeredRef.current && !recording ? 'opacity-40 cursor-not-allowed' : ''
                } ${recording ? 'bg-rose-500 text-white' : 'bg-primary text-white hover:bg-primary-light hover:scale-105'}`}
                aria-label={recording ? 'Arrêter' : 'Répondre tout de suite au micro'}
              >
                {recording ? '⏹' : '🎤'}
              </button>
              <p className="mt-3 text-xs text-gray-400 text-center max-w-sm">
                {recording
                  ? 'En écoute… réponds avec le résultat (chiffres de préférence)'
                  : "Appuie sur Espace (ou le bouton 🎤) pour entendre l'énoncé et activer le micro."}
              </p>
              {audioTranscript && <p className="mt-4 text-2xl font-bold text-gray-700">"{audioTranscript}"</p>}
              {audioResult !== null && (
                <p className={`mt-2 text-3xl font-extrabold ${audioResult ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {audioResult ? '✅ Correct !' : `❌ ${current.answer}`}
                </p>
              )}
              {audioError && <p className="mt-3 text-base text-rose-500">{audioError}</p>}

              {/* Typing fallback */}
              {audioResult === null && !recording && (
                <div className="mt-6 w-full border-t border-gray-100 pt-5 flex flex-col gap-2">
                  <p className="text-xs text-gray-400 text-center">Si le micro ne fonctionne pas, tape la réponse :</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="?"
                      value={typingAnswer}
                      disabled={answeredRef.current}
                      onChange={e => setTypingAnswer(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && typingAnswer.trim() && !answeredRef.current) {
                          const answer = Number(typingAnswer.trim())
                          const correct = Number.isFinite(answer) && answer === current.answer
                          setTypingResult(correct)
                          markAnswer(correct)
                        }
                      }}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center text-primary outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => {
                        if (!typingAnswer.trim() || answeredRef.current) return
                        const answer = Number(typingAnswer.trim())
                        const correct = Number.isFinite(answer) && answer === current.answer
                        setTypingResult(correct)
                        markAnswer(correct)
                      }}
                      disabled={!typingAnswer.trim() || answeredRef.current}
                      className={`px-5 py-3 rounded-xl font-bold text-lg transition-all ${
                        typingAnswer.trim() && !answeredRef.current
                          ? 'bg-primary text-white hover:bg-primary-light'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      OK
                    </button>
                  </div>
                  {typingResult !== null && (
                    <p className={`text-2xl font-extrabold text-center mt-1 ${typingResult ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {typingResult ? '✅ Correct !' : `❌ ${current.answer}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes timeoutshake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
