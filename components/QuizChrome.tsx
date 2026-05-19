'use client'

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface QuizChromeProps {
  backLabel: string
  onBack: () => void
  modeLabel: string
  currentIndex: number
  total: number
  elapsed: number
  correctCount: number
  timerEnabled?: boolean
  timerSeconds?: number
  shakeClass?: string
}

export function QuizChrome({
  backLabel,
  onBack,
  modeLabel,
  currentIndex,
  total,
  elapsed,
  correctCount,
  timerEnabled,
  timerSeconds,
  shakeClass = '',
}: QuizChromeProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors"
        >
          {backLabel}
        </button>
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          {modeLabel}
        </span>
      </div>

      <div className={`mb-6 ${shakeClass}`}>
        <div className="flex justify-between text-sm font-semibold text-gray-500 mb-1.5">
          <span>Question {currentIndex + 1} / {total}</span>
          <span className="flex items-center gap-3">
            {timerEnabled && timerSeconds !== undefined && (
              <span className="text-rose-500">⏳ {timerSeconds}s</span>
            )}
            <span className="text-gray-400 font-normal tabular-nums">⏱ {fmtTime(elapsed)}</span>
            <span>{correctCount} correctes</span>
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
      </div>
    </>
  )
}
