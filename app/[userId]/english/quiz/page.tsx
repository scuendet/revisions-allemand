'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { QuizChrome } from '@/components/QuizChrome'

interface VocabItem {
  id: number
  french: string
  english: string
  unit: number
  unit_title: string
}

interface Result {
  vocabId: number
  correct: boolean
  english: string
  french: string
}

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!;:'"()\-?]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function EnglishQuizPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const userId = params.userId as string

  const unitsParam = searchParams.get('units') || ''
  const mode = (searchParams.get('mode') || 'flashcard') as 'flashcard' | 'audio' | 'typing'
  const countParamRaw = searchParams.get('count') || '10'
  const countParam = countParamRaw === 'all' ? 'all' : parseInt(countParamRaw, 10)
  const smartMode = searchParams.get('smart') !== '0'

  const [items, setItems] = useState<VocabItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [done, setDone] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  // Flashcard state
  const [flipped, setFlipped] = useState(false)
  const [answered, setAnswered] = useState(false)

  // Typing state
  const [typingAnswer, setTypingAnswer] = useState('')
  const [typingResult, setTypingResult] = useState<{ correct: boolean; shown: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Audio state
  const [recording, setRecording] = useState(false)
  const [audioResult, setAudioResult] = useState<{ correct: boolean; transcribed: string } | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [micError, setMicError] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [audioDebugLog, setAudioDebugLog] = useState<string[]>([])
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioGenRef = useRef(0)
  const deferredSpeakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postPromptListenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioQuestionRef = useRef<VocabItem | null>(null)
  const recognitionListeningRef = useRef(false)

  function debugLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23)
    setAudioDebugLog(prev => [...prev, `${ts} ${msg}`])
    console.log('[audio]', msg)
  }

  useEffect(() => {
    const units = unitsParam.split(',').map(Number).filter(Boolean)
    setLoadError('')
    fetch('/api/english/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        units,
        count: countParam,
        user_id: parseInt(userId),
        mode,
        smart: smartMode,
      }),
    })
      .then(async r => {
        if (!r.ok) throw new Error('Impossible de charger la session de vocabulaire.')
        return r.json()
      })
      .then(data => { setItems(data); startTimeRef.current = Date.now() })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Impossible de charger la session de vocabulaire.'
        setItems([])
        setLoadError(message)
      })
      .finally(() => setLoading(false))
  }, [unitsParam, countParam, userId, mode, smartMode])

  const doneRef = useRef(done)
  doneRef.current = done

  const current = items[currentIndex]

  useEffect(() => {
    audioQuestionRef.current = current ?? null
  }, [current])

  useEffect(() => {
    if (mode === 'typing' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, mode])

  // Keyboard shortcuts for flashcard mode
  useEffect(() => {
    if (mode !== 'flashcard' || done) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!flipped) setFlipped(true)
      } else if ((e.key === 'y' || e.key === 'ArrowRight') && flipped && !answered) {
        e.preventDefault()
        handleFlashcardAnswer(true)
      } else if ((e.key === 'n' || e.key === 'ArrowLeft') && flipped && !answered) {
        e.preventDefault()
        handleFlashcardAnswer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, done, flipped, answered])

  // Keyboard shortcuts for audio mode
  useEffect(() => {
    if (mode !== 'audio' || done) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ') {
        e.preventDefault()
        if (!audioResult && !audioLoading) {
          if (recording) stopRecording()
          else {
            cancelSynthAndScheduledListen()
            startRecording()
          }
        }
      } else if (e.key === 'Enter' && audioResult) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, done, recording, audioResult, audioLoading])

  // Live timer
  useEffect(() => {
    if (loading || done) return
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [loading, done])

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function saveResult(vocabId: number, correct: boolean) {
    await fetch('/api/english/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId), vocab_id: vocabId, mode, correct }),
    })
  }

  async function handleFlashcardAnswer(correct: boolean) {
    if (answered) return
    setAnswered(true)
    await saveResult(current.id, correct)
    setResults(prev => [...prev, { vocabId: current.id, correct, english: current.english, french: current.french }])
    setTimeout(() => advance(), 400)
  }

  function advance() {
    if (currentIndex + 1 >= items.length) {
      const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0
      setElapsed(duration)
      setDone(true)
      const units = unitsParam.split(',').map(Number).filter(Boolean)
      fetch('/api/english/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), units, mode, duration_seconds: duration }),
      })
    } else {
      setCurrentIndex(i => i + 1)
      setFlipped(false)
      setAnswered(false)
      setTypingAnswer('')
      setTypingResult(null)
      setAudioResult(null)
      setMicError('')
      setPlaybackUrl(null)
      setAudioDebugLog([])
      recognitionListeningRef.current = false
    }
  }

  function handleTypingSubmit() {
    if (typingResult?.shown) {
      advance()
      return
    }
    if (!typingAnswer.trim()) return
    const norm = normalizeAnswer(typingAnswer)
    const expected = normalizeAnswer(current.english)
    const correct = norm === expected
    setTypingResult({ correct, shown: true })
    saveResult(current.id, correct)
    setResults(prev => [...prev, { vocabId: current.id, correct, english: current.english, french: current.french }])
  }

  function clearFrenchPromptSchedule() {
    if (deferredSpeakTimeoutRef.current !== null) {
      clearTimeout(deferredSpeakTimeoutRef.current)
      deferredSpeakTimeoutRef.current = null
    }
    if (postPromptListenTimeoutRef.current !== null) {
      clearTimeout(postPromptListenTimeoutRef.current)
      postPromptListenTimeoutRef.current = null
    }
    window.speechSynthesis.cancel()
    try {
      recognitionRef.current?.stop()
    } catch {
      recognitionRef.current?.abort?.()
    }
    recognitionListeningRef.current = false
  }

  function cancelSynthAndScheduledListen() {
    audioGenRef.current += 1
    if (deferredSpeakTimeoutRef.current !== null) {
      clearTimeout(deferredSpeakTimeoutRef.current)
      deferredSpeakTimeoutRef.current = null
    }
    if (postPromptListenTimeoutRef.current !== null) {
      clearTimeout(postPromptListenTimeoutRef.current)
      postPromptListenTimeoutRef.current = null
    }
    window.speechSynthesis.cancel()
  }

  function speakFrenchThenListen(frenchText: string) {
    audioGenRef.current += 1
    const myGen = audioGenRef.current
    clearFrenchPromptSchedule()

    try {
      window.speechSynthesis.resume()
    } catch {
      /* ignore */
    }

    deferredSpeakTimeoutRef.current = setTimeout(() => {
      deferredSpeakTimeoutRef.current = null
      if (audioGenRef.current !== myGen || doneRef.current) return

      window.speechSynthesis.getVoices()

      const utter = new SpeechSynthesisUtterance(frenchText)
      utter.lang = 'fr-FR'
      utter.rate = 0.9
      utter.onend = () => {
        if (audioGenRef.current !== myGen || doneRef.current) return
        postPromptListenTimeoutRef.current = setTimeout(() => {
          postPromptListenTimeoutRef.current = null
          if (audioGenRef.current !== myGen || doneRef.current) return
          startRecording()
        }, 160)
      }
      utter.onerror = () => {
        if (audioGenRef.current !== myGen || doneRef.current) return
        postPromptListenTimeoutRef.current = setTimeout(() => {
          postPromptListenTimeoutRef.current = null
          if (audioGenRef.current !== myGen || doneRef.current) return
          startRecording()
        }, 160)
      }
      window.speechSynthesis.speak(utter)
    }, 40)
  }

  function startRecording() {
    setMicError('')
    setPlaybackUrl(null)
    setAudioDebugLog([])

    const vocab = audioQuestionRef.current
    if (!vocab) return

    if (recognitionListeningRef.current) {
      debugLog('startRecording skipped (already listening)')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicError('La reconnaissance vocale n\'est pas supportée par ce navigateur. Essaie Chrome.')
      return
    }

    debugLog('Creating SpeechRecognition (en-GB)')
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    recognitionRef.current = recognition

    recognition.onstart = async () => {
      debugLog('onstart fired — recognition is listening')
      recognitionListeningRef.current = true
      setRecording(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        chunksRef.current = []
        const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || ''
        const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        mediaRecorderRef.current = mr
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(chunksRef.current, { type: mr.mimeType.split(';')[0] || 'audio/webm' })
          setPlaybackUrl(URL.createObjectURL(blob))
          debugLog(`MediaRecorder stopped — blob size: ${blob.size} bytes`)
        }
        mr.start()
        debugLog('MediaRecorder started')
      } catch (err) {
        debugLog(`MediaRecorder stream failed: ${err}`)
      }
    }

    recognition.onend = () => {
      debugLog('onend fired')
      recognitionListeningRef.current = false
      setRecording(false)
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
    }

    recognition.onerror = (e: any) => {
      debugLog(`onerror fired: ${e.error}`)
      recognitionListeningRef.current = false
      if (e.error === 'not-allowed') {
        setMicError('Permission microphone refusée. Active le microphone dans les paramètres de ton navigateur.')
      } else if (e.error === 'no-speech') {
        setMicError('Aucune voix détectée. Essaie de parler plus fort ou plus près du micro.')
      } else {
        setMicError(`Erreur de reconnaissance vocale : ${e.error}`)
      }
    }

    recognition.onresult = async (e: any) => {
      const transcribed = e.results[0][0].transcript.trim()
      const confidence = (e.results[0][0].confidence * 100).toFixed(0)
      debugLog(`onresult: "${transcribed}" (confiance ${confidence}%)`)
      setAudioLoading(true)
      try {
        const item = audioQuestionRef.current
        if (!item) return
        const res = await fetch('/api/english/audio/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcribed, expected_english: item.english }),
        })
        const data = await res.json()
        if (data.error) {
          debugLog(`interpret ERROR: ${data.error}`)
          setMicError(`Erreur API : ${data.error}`)
          return
        }
        debugLog(`interpret result: correct=${data.correct}`)
        setAudioResult(data)
        await saveResult(item.id, data.correct)
        setResults(prev => [
          ...prev,
          { vocabId: item.id, correct: data.correct, english: item.english, french: item.french },
        ])
      } catch (err) {
        debugLog(`interpret error: ${err}`)
        setMicError('Erreur lors de l\'interprétation.')
      } finally {
        setAudioLoading(false)
      }
    }

    recognition.start()
    debugLog('recognition.start() called')
  }

  useEffect(() => {
    if (loading || mode !== 'audio' || !current || done) return
    speakFrenchThenListen(current.french)
    return () => {
      audioGenRef.current += 1
      clearFrenchPromptSchedule()
    }
  }, [currentIndex, loading, mode, done, current?.id])

  function stopRecording() {
    debugLog('stopRecording called manually')
    recognitionRef.current?.stop()
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
            onClick={() => router.push(`/${userId}/english`)}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
          >
            Retour au menu
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center mb-6">
            <div className="text-5xl mb-4">{correctCount === items.length ? '🎉' : correctCount >= items.length * 0.7 ? '👍' : '💪'}</div>
            <h2 className="text-3xl font-extrabold text-primary mb-1">
              {correctCount} / {items.length}
            </h2>
            <p className="text-gray-500 font-medium">
              {correctCount === items.length ? 'Parfait !' : 'Continue comme ça !'}
            </p>
            <p className="text-sm text-gray-400 mt-3">⏱ {formatTime(elapsed)}</p>
          </div>

          {missedItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
              <h3 className="font-extrabold text-primary mb-3">Mots à revoir</h3>
              <div className="space-y-2">
                {missedItems.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-rose-50">
                    <span className="text-gray-600">{r.french}</span>
                    <span className="font-semibold text-primary">{r.english}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentIndex(0)
                setResults([])
                setDone(false)
                setFlipped(false)
                setAnswered(false)
                setTypingAnswer('')
                setTypingResult(null)
                setAudioResult(null)
                setElapsed(0)
                startTimeRef.current = null
                setLoading(true)
                const units = unitsParam.split(',').map(Number).filter(Boolean)
                fetch('/api/english/start', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    units,
                    count: countParam,
                    user_id: parseInt(userId),
                    mode,
                    smart: smartMode,
                  }),
                })
                  .then(r => r.json())
                  .then(data => { setItems(data); setLoading(false); startTimeRef.current = Date.now() })
              }}
              className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-light transition-colors"
            >
              Recommencer
            </button>
            <button
              onClick={() => router.push(`/${userId}/english`)}
              className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-bold hover:bg-primary/5 transition-colors"
            >
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
        <QuizChrome
          backLabel="← Menu"
          onBack={() => router.push(`/${userId}/english`)}
          modeLabel={mode === 'flashcard' ? '🃏 Flashcards' : mode === 'audio' ? '🎤 Audio' : '⌨️ Frappe'}
          currentIndex={currentIndex}
          total={items.length}
          elapsed={elapsed}
          correctCount={correctCount}
        />

        {/* Mode: Flashcard */}
        {mode === 'flashcard' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="card-flip-container h-56">
              <div className={`card-inner h-full ${flipped ? 'flipped' : ''}`}>
                <div className="card-front bg-white rounded-2xl shadow-md border border-gray-100 flex flex-col items-center justify-center p-8 overflow-hidden">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Français</p>
                  <p className="text-2xl font-bold text-primary text-center leading-snug">{current.french}</p>
                </div>
                <div className="card-back bg-primary rounded-2xl shadow-md flex flex-col items-center justify-center p-8 overflow-hidden">
                  <p className="text-xs font-semibold text-accent/80 uppercase tracking-wide mb-3">Anglais</p>
                  <p className="text-2xl font-bold text-white text-center leading-snug">{current.english}</p>
                </div>
              </div>
            </div>

            {!flipped ? (
              <button
                onClick={() => setFlipped(true)}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-light transition-colors shadow-sm"
              >
                Retourner <span className="text-white/50 text-sm font-normal ml-1">[Espace]</span>
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleFlashcardAnswer(false)}
                  className="flex-1 py-4 bg-rose-400 text-white rounded-xl font-bold text-lg hover:bg-rose-500 transition-colors shadow-sm"
                >
                  ❌ Je ne savais pas <span className="text-white/50 text-sm font-normal">[N / ←]</span>
                </button>
                <button
                  onClick={() => handleFlashcardAnswer(true)}
                  className="flex-1 py-4 bg-emerald-400 text-white rounded-xl font-bold text-lg hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  ✅ Je savais <span className="text-white/50 text-sm font-normal">[Y / →]</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mode: Typing */}
        {mode === 'typing' && (
          <div className="flex-1 flex flex-col">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Français</p>
              <p className="text-2xl font-bold text-primary text-center mb-6">{current.french}</p>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={typingAnswer}
                  onChange={e => setTypingAnswer(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleTypingSubmit()
                  }}
                  readOnly={!!typingResult?.shown}
                  placeholder="Écris la réponse en anglais…"
                  className={`w-full border-2 rounded-xl px-4 py-3 text-primary font-semibold text-lg outline-none transition-colors ${
                    typingResult?.shown
                      ? typingResult.correct
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-rose-400 bg-rose-50'
                      : 'border-gray-200 focus:border-accent'
                  }`}
                />
              </div>

              {typingResult?.shown && (
                <div className={`mt-4 p-3 rounded-xl text-sm font-semibold ${typingResult.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {typingResult.correct ? '✅ Correct !' : `❌ La bonne réponse était : ${current.english}`}
                </div>
              )}
            </div>

            <button
              onClick={handleTypingSubmit}
              disabled={!typingAnswer.trim() && !typingResult?.shown}
              className={`py-4 rounded-xl font-bold text-lg transition-all ${
                (typingAnswer.trim() || typingResult?.shown)
                  ? 'bg-primary text-white hover:bg-primary-light shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {typingResult?.shown ? 'Suivant →' : 'Valider'}
            </button>
          </div>
        )}

        {/* Mode: Audio */}
        {mode === 'audio' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col items-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Français</p>
              <div className="flex items-center gap-3 mb-8">
                <p className="text-2xl font-bold text-primary text-center">{current.french}</p>
                <button
                  type="button"
                  onClick={() => speakFrenchThenListen(current.french)}
                  title="Réécouter et répondre"
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 hover:bg-accent/20 flex items-center justify-center text-lg transition-colors"
                >
                  🔊
                </button>
              </div>

              {micError && (
                <div className="mb-4 bg-rose-50 text-rose-600 rounded-xl p-3 text-sm text-center w-full">
                  {micError}
                </div>
              )}

              {!audioResult && !audioLoading && (
                <button
                  type="button"
                  onClick={
                    recording
                      ? stopRecording
                      : () => {
                          cancelSynthAndScheduledListen()
                          startRecording()
                        }
                  }
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all ${
                    recording
                      ? 'bg-rose-500 text-white mic-pulsing'
                      : 'bg-primary text-white hover:bg-primary-light hover:scale-105'
                  }`}
                  aria-label={recording ? 'Arrêter' : 'Parler tout de suite'}
                >
                  {recording ? '⏹' : '🎤'}
                </button>
              )}

              {!audioResult && !audioLoading && (
                <p className="mt-3 text-xs text-gray-400 text-center max-w-sm">
                  {recording
                    ? "En écoute… Parle puis attends l'analyse · [Espace] pour arrêter"
                    : "Le micro s'active tout seul après la lecture française — ou utilise le bouton / [Espace] pour passer tout de suite en écoute."}
                </p>
              )}

              {audioLoading && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 font-medium">Analyse en cours…</p>
                </div>
              )}

              {audioResult && (
                <div className={`w-full p-4 rounded-xl ${audioResult.correct ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Tu as dit :</p>
                      <p className="font-bold text-primary text-lg">"{audioResult.transcribed}"</p>
                    </div>
                    {playbackUrl && (
                      <audio controls src={playbackUrl} className="h-8 w-32 ml-3" />
                    )}
                  </div>
                  {audioResult.correct ? (
                    <p className="text-emerald-700 font-bold">✅ Correct !</p>
                  ) : (
                    <p className="text-rose-700 font-semibold">❌ La bonne réponse était : <span className="font-bold">{current.english}</span></p>
                  )}
                </div>
              )}
            </div>

            {audioResult && (
              <button
                onClick={advance}
                className="py-4 rounded-xl font-bold text-lg bg-primary text-white hover:bg-primary-light transition-colors shadow-md"
              >
                Suivant → <span className="text-white/50 text-sm font-normal">[Entrée]</span>
              </button>
            )}

            {audioDebugLog.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-3 text-xs font-mono text-green-400 space-y-0.5 max-h-36 overflow-y-auto">
                {audioDebugLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
