'use client'

import { useEffect, useState } from 'react'

export default function TestSpeechPage() {
  const [log, setLog] = useState<string[]>([])
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  function addLog(msg: string) {
    setLog(prev => [...prev, `${new Date().toISOString().slice(11, 23)} — ${msg}`])
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    addLog(`speechSynthesis disponible: ${'speechSynthesis' in window}`)
    addLog(`paused=${window.speechSynthesis.paused}, speaking=${window.speechSynthesis.speaking}, pending=${window.speechSynthesis.pending}`)
    const load = () => {
      const v = window.speechSynthesis.getVoices()
      setVoices(v)
      addLog(`voiceschanged: ${v.length} voix`)
    }
    window.speechSynthesis.addEventListener('voiceschanged', load)
    const initial = window.speechSynthesis.getVoices()
    if (initial.length > 0) { setVoices(initial); addLog(`getVoices() initial: ${initial.length} voix`) }
    else addLog('getVoices() initial: 0 voix')
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  function doSpeak(text: string, voice?: SpeechSynthesisVoice) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.9
    if (voice) { utter.voice = voice; utter.lang = voice.lang }
    utter.onstart = () => addLog('onstart ✅')
    utter.onend   = () => addLog('onend ✅')
    utter.onerror = (e) => addLog(`onerror ❌ "${e.error}"`)
    window.speechSynthesis.speak(utter)
    addLog(`speak() appelé → pending=${window.speechSynthesis.pending} speaking=${window.speechSynthesis.speaking}`)
  }

  // Direct: called synchronously inside click handler — Chrome should allow this
  function speakDirect(text: string, voice?: SpeechSynthesisVoice) {
    addLog('--- DIRECT (no cancel, no timeout) ---')
    doSpeak(text, voice)
  }

  // With cancel then immediate speak — known Chrome bug trigger
  function speakAfterCancel(text: string) {
    addLog('--- CANCEL then immediate speak ---')
    window.speechSynthesis.cancel()
    doSpeak(text)
  }

  // With cancel then 50ms timeout — loses user gesture
  function speakAfterTimeout(text: string) {
    addLog('--- CANCEL then speak after 50ms setTimeout ---')
    window.speechSynthesis.cancel()
    setTimeout(() => doSpeak(text), 50)
  }

  const frVoices = voices.filter(v => v.lang.startsWith('fr'))

  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-primary mb-2">Test Speech Synthesis</h1>
      <p className="text-sm text-gray-500 mb-6">Teste chaque bouton dans l'ordre et regarde le log.</p>

      <div className="space-y-2 mb-6">
        <p className="text-xs font-bold uppercase text-gray-400 mt-4">1 — Direct (dans le click handler)</p>
        <button onClick={() => speakDirect('quatre fois six')}
          className="block w-full bg-primary text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Direct — "quatre fois six"
        </button>
        <button onClick={() => speakDirect('four times six')}
          className="block w-full bg-emerald-600 text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Direct — "four times six" (anglais)
        </button>

        <p className="text-xs font-bold uppercase text-gray-400 mt-4">2 — Après cancel() immédiat</p>
        <button onClick={() => speakAfterCancel('quatre fois six')}
          className="block w-full bg-primary text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Cancel + speak immédiat
        </button>

        <p className="text-xs font-bold uppercase text-gray-400 mt-4">3 — Après cancel() + setTimeout 50ms</p>
        <button onClick={() => speakAfterTimeout('quatre fois six')}
          className="block w-full bg-primary text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Cancel + speak après 50ms
        </button>

        {frVoices.length > 0 && <>
          <p className="text-xs font-bold uppercase text-gray-400 mt-4">4 — Voix françaises explicites</p>
          {frVoices.map(v => (
            <button key={v.name} onClick={() => speakDirect('quatre fois six', v)}
              className="block w-full bg-accent text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
              {v.name} ({v.lang})
            </button>
          ))}
        </>}

        <p className="text-xs font-bold uppercase text-gray-400 mt-4">Utilitaire</p>
        <button onClick={() => { window.speechSynthesis.cancel(); addLog('cancel()') }}
          className="block w-full bg-rose-500 text-white rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Cancel
        </button>
        <button onClick={() => setLog([])}
          className="block w-full bg-gray-300 text-gray-700 rounded-xl px-4 py-3 font-semibold hover:opacity-90">
          Effacer le log
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <p className="text-xs font-bold uppercase text-gray-400 mb-2">Log</p>
        {log.length === 0 && <p className="text-sm text-gray-400">Aucun événement</p>}
        <ul className="space-y-0.5">
          {log.map((l, i) => (
            <li key={i} className={`text-xs font-mono ${l.includes('❌') ? 'text-rose-600' : l.includes('✅') ? 'text-emerald-600' : 'text-gray-700'}`}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase text-gray-400 mb-2">Voix ({voices.length})</p>
        {voices.length === 0 && <p className="text-sm text-gray-400">Aucune voix</p>}
        <ul className="space-y-0.5">
          {voices.map(v => (
            <li key={v.name} className={`text-xs font-mono ${v.lang.startsWith('fr') ? 'text-primary font-bold' : 'text-gray-400'}`}>
              {v.name} — {v.lang}{v.default ? ' ★' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
