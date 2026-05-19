'use client'

import { useRouter } from 'next/navigation'

type QuizMode = 'flashcard' | 'audio' | 'typing'

const MODE_BUTTONS: { mode: QuizMode; emoji: string; short: string }[] = [
  { mode: 'flashcard', emoji: '🃏', short: 'Flashcards' },
  { mode: 'audio', emoji: '🎤', short: 'Audio' },
  { mode: 'typing', emoji: '⌨️', short: 'Frappe' },
]

interface UnitVocabPracticeProps {
  userId: string
  unit: number
  count?: number
  /** Text before the mode buttons */
  label?: boolean
  compact?: boolean
  subject?: 'german' | 'english'
}

export function UnitVocabPractice({
  userId,
  unit,
  count = 10,
  label = true,
  compact = false,
  subject = 'german',
}: UnitVocabPracticeProps) {
  const router = useRouter()

  function start(mode: QuizMode) {
    const params = new URLSearchParams({
      units: String(unit),
      mode,
      count: String(count),
    })
    const path = subject === 'english' ? `/${userId}/english/quiz` : `/${userId}/quiz`
    router.push(`${path}?${params}`)
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mt-1.5'}`}>
      {label && (
        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
          Entraîner ({count})&nbsp;:
        </span>
      )}
      <div className="flex gap-1">
        {MODE_BUTTONS.map(({ mode, emoji, short }) => (
          <button
            key={mode}
            type="button"
            onClick={() => start(mode)}
            aria-label={`${short} — ${count} questions, unité ${unit}`}
            title={`${short} · ${count} questions`}
            className={
              compact
                ? 'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg leading-none text-primary shadow-sm transition-colors hover:border-accent hover:bg-accent/5'
                : 'flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-accent hover:bg-accent/5'
            }
          >
            <span aria-hidden>{emoji}</span>
            {!compact && <span className="hidden sm:inline">{short}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
