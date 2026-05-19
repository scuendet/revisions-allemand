import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/store'
import vocab from '@/data/vocab.json'
import type { SubjectProgressSummary } from '@/lib/subjectProgress'

interface Result {
  id: number
  vocab_id: number
  mode: string
  correct: number
  attempted_at: string
}

interface QuizSession {
  id: number
  duration_seconds: number
  completed_at: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = parseInt(params.userId)
  const [results, sessions] = await Promise.all([
    readJson<Result[]>(`results-${userId}.json`, []),
    readJson<QuizSession[]>(`quiz-sessions-${userId}.json`, []),
  ])

  const detail = vocab.map(v => {
    const vr = results.filter(r => r.vocab_id === v.id)
    return {
      vocab_id: v.id,
      french: v.french,
      german: v.german,
      unit: v.unit,
      unit_title: v.unit_title,
      total_attempts: vr.length,
      correct_attempts: vr.filter(r => r.correct === 1).length,
      flashcard_attempts: vr.filter(r => r.mode === 'flashcard').length,
      flashcard_correct: vr.filter(r => r.mode === 'flashcard' && r.correct === 1).length,
      audio_attempts: vr.filter(r => r.mode === 'audio').length,
      audio_correct: vr.filter(r => r.mode === 'audio' && r.correct === 1).length,
      typing_attempts: vr.filter(r => r.mode === 'typing').length,
      typing_correct: vr.filter(r => r.mode === 'typing' && r.correct === 1).length,
      last_attempted: vr.length > 0 ? vr[vr.length - 1].attempted_at : null,
    }
  }).sort((a, b) => a.unit - b.unit || a.vocab_id - b.vocab_id)

  const summary: SubjectProgressSummary = {
    total_attempts: results.length,
    correct_attempts: results.filter(r => r.correct === 1).length,
    total_sessions: sessions.length,
    total_seconds: Math.round(sessions.reduce((s, q) => s + (q.duration_seconds ?? 0), 0)),
    last_attempted: results.length > 0 ? results[results.length - 1].attempted_at : null,
  }

  return NextResponse.json({ summary, detail })
}
