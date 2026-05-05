'use client'

import Link from 'next/link'
import { MATH_PERFECT_SESSION_BONUS } from '@/lib/checksConfig'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type CheckLedgerApiEntry =
  | {
      kind: 'earn'
      id: number
      created_at: string
      checks: number
      headline: string
      detail?: string
    }
  | {
      kind: 'spend'
      id: number
      created_at: string
      checks: number
      note: string
      redemption_id: number
    }
  | {
      kind: 'spend_undo'
      id: number
      created_at: string
      checks: number
      redemption_id: number
      note?: string
    }

interface ChecksPayload {
  pointsPerCheck: number
  mathCorrectsPerPoint: number
  germanCorrect_vocab: number
  germanCorrect_verbs: number
  germanCorrect: number
  mathCorrect: number
  mathPointsFromAnswers: number
  mathPerfectSessionBonusPoints: number
  germanPoints: number
  mathPoints: number
  frenchPoints: number
  totalPoints: number
  earnedChecks: number
  usedChecks: number
  availableChecks: number
  remainderPoints: number
  redemptions: Array<{
    id: number
    checks_used: number
    note: string
    created_at: string
  }>
  ledger?: CheckLedgerApiEntry[]
}

function formatDt(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function ChecksPage() {
  const params = useParams()
  const userId = params.userId as string

  const [data, setData] = useState<ChecksPayload | null>(null)
  const [loadError, setLoadError] = useState('')
  const [checksInput, setChecksInput] = useState('1')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const reload = useCallback(() => {
    setLoadError('')
    fetch(`/api/checks/${userId}`)
      .then(async r => {
        const j = await r.json().catch(() => null)
        if (!r.ok) {
          setLoadError(typeof j?.error === 'string' ? j.error : 'Impossible de charger la banque.')
          return
        }
        setData(j as ChecksPayload)
      })
      .catch(() => setLoadError('Erreur réseau.'))
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  const pointsPerCheck = data?.pointsPerCheck ?? 20
  const remainderPoints = data?.remainderPoints ?? 0
  const progressPct =
    remainderPoints >= 0 && pointsPerCheck > 0 ? Math.min(100, Math.round((remainderPoints / pointsPerCheck) * 100)) : 0

  async function handleRedeem() {
    if (!data) return
    const n = Math.floor(Number(checksInput))
    if (!Number.isFinite(n) || n < 1) {
      alert('Indique un nombre de chèques valide.')
      return
    }
    if (!note.trim()) {
      alert('Ajoute une courte note au registre (pour quoi le chèque a été utilisé).')
      return
    }
    if (n > data.availableChecks) {
      alert(
        data.availableChecks === 0
          ? 'Pas encore de chèques — continue à gagner des points !'
          : `Tu as seulement ${data.availableChecks} chèque(s) disponible(s).`
      )
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checks/${userId}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks_used: n, note: note.trim() }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        alert(typeof j?.error === 'string' ? j.error : 'Échec de l\'enregistrement.')
        return
      }
      setChecksInput('1')
      setNote('')
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(id: number) {
    if (!confirm('Retirer cette ligne du registre ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/checks/${userId}/redeem/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        alert(typeof j?.error === 'string' ? j.error : 'Suppression impossible.')
        return
      }
      reload()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/${userId}`}
            className="text-sm font-semibold text-gray-400 transition-colors hover:text-primary"
          >
            ← Menu
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Banque des chèques</span>
        </div>

        <div className="mb-2">
          <h1 className="text-3xl font-extrabold text-primary">Banque des chèques</h1>
          <p className="mt-1 text-sm text-gray-500 leading-snug">
            Les points de pratique deviennent des chèques famille ({pointsPerCheck} points = 1 chèque).
            Les chèques servent ensuite pour ce que vous décidez ensemble (temps écran, gâterie, etc.).
          </p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </div>
        )}

        {/* Hero */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-8 text-white shadow-lg">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
          <div className="relative z-10 flex flex-wrap items-end gap-8">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-90">Disponibles</p>
              <p className="text-5xl font-extrabold leading-none tabular-nums">
                {!data ? '…' : data.availableChecks}
              </p>
              <p className="mt-2 text-xs opacity-90">Chèques prêts à utiliser</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-90">Points totaux</p>
              <p className="text-3xl font-bold tabular-nums">{!data ? '…' : data.totalPoints.toLocaleString('fr-CH')}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-90">Échangés à vie</p>
              <p className="text-3xl font-bold tabular-nums">{!data ? '…' : data.usedChecks}</p>
            </div>
          </div>
          {data !== null ? (
            <div className="relative z-10 mt-8">
              <p className="mb-2 text-xs font-medium opacity-90">
                Vers le prochain chèque : {remainderPoints} / {pointsPerCheck} pts ({Math.max(0, 100 - progressPct)} %
                restant)
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Gagnés (calculé)', val: data?.earnedChecks },
            { label: 'Échangés', val: data?.usedChecks },
            { label: 'Réponses ✓ (all)', val: data ? (data.germanCorrect + (data.mathCorrect ?? 0)) : undefined },
          ].map(row => (
            <div key={row.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-2xl font-extrabold text-primary tabular-nums">
                {row.val === undefined ? '…' : row.val.toLocaleString('fr-CH')}
              </p>
              <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{row.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <h2 className="font-extrabold text-primary">Comment gagner des points</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 leading-snug">
            <li>
              <strong className="text-primary">Allemand</strong> (vocabulaire ou conjugaison) :{' '}
              <span className="font-semibold">1 bonne réponse = 1 point</span>.
            </li>
            <li>
              <strong className="text-primary">Français</strong> (conjugaison) :{' '}
              <span className="font-semibold">1 bonne réponse × multiplicateur (Facile ×1, Moyen ×2, Difficile ×5)</span>.
              Série parfaite : bonus +5 pts (10Q) ou +10 pts (20Q).
            </li>
            <li>
              <strong className="text-primary">Tables de multiplication</strong> :{' '}
              <span className="font-semibold">3 bonnes réponses = 1 point</span>.
            </li>
            <li className="text-gray-700">
              <strong className="text-primary">Bonus maths</strong> si toute une série tables est bonne :{' '}
              <span className="font-semibold">+{MATH_PERFECT_SESSION_BONUS} pts</span> (un seul bonus par série terminée).
            </li>
          </ul>
          {data ? (
            <div className="mt-4 space-y-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <p>
                Points allemand : <strong>{data.germanPoints}</strong> ({data.germanCorrect} réponses —
                vocab {data.germanCorrect_vocab}, verbes {data.germanCorrect_verbs})
              </p>
              <p>
                Points français : <strong>{data.frenchPoints ?? 0}</strong>
              </p>
              <p>
                Points maths (tables) : <strong>{data.mathPoints}</strong> dont{' '}
                <strong>{data.mathPointsFromAnswers}</strong> sur les bonnes réponses ({data.mathCorrect} justes → ÷{' '}
                {data.mathCorrectsPerPoint})
                {data.mathPerfectSessionBonusPoints > 0 ? (
                  <>
                    {' '}
                    · bonus séries parfaites : <strong>+{data.mathPerfectSessionBonusPoints}</strong>
                  </>
                ) : null}
              </p>
              <p className="pt-1 font-semibold text-primary">
                Total : {data.totalPoints} pts → {data.earnedChecks} chèque(s) gagné(s) (conversion {data.pointsPerCheck}{' '}
                pts/chèque)
              </p>
            </div>
          ) : null}
        </div>

        {/* Redeem */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-extrabold text-primary text-lg">Enregistrer un chèque utilisé</h2>
          <p className="mt-1 text-sm text-gray-500 mb-4">
            Quand un chèque gagné est dépensé, note-le ici pour garder la caisse à jour.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block text-xs font-semibold text-gray-500">
              Nombre de chèques
              <input
                type="number"
                min={1}
                max={data?.availableChecks || undefined}
                value={checksInput}
                onChange={e => setChecksInput(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-primary outline-none focus:border-accent sm:w-28"
              />
            </label>
            <label className="block min-w-0 flex-1 text-xs font-semibold text-gray-500">
              Note (pourquoi ce chèque ?)
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex. temps écran 30 min"
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-primary outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRedeem()}
              disabled={submitting || !data || data.availableChecks <= 0 || !note.trim()}
              className="rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Grand livre */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-extrabold text-primary text-lg">Grand livre</h2>
          <p className="mt-1 text-sm text-gray-500 mb-4">
            Tout mouvement de chèques : gains (pourquoi, d’où), dépenses familiales, corrections.
            Les lignes les plus récentes en premier.
          </p>
          {!data ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : (data.ledger ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm">
              Pas encore de mouvements. Entraîne-toi puis ouvre cette page : l’historique se remplit automatiquement.
            </p>
          ) : (
            <ul className="space-y-3">
              {(data.ledger ?? []).map(row => (
                <li
                  key={`${row.kind}-${row.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    {row.kind === 'earn' ? (
                      <>
                        <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-800">
                          +{row.checks} chèque{row.checks !== 1 ? 's' : ''} (gain)
                        </span>
                        <p className="mt-1 font-semibold text-primary">{row.headline}</p>
                        {row.detail ? <p className="mt-0.5 text-sm text-gray-600 leading-snug">{row.detail}</p> : null}
                        <p className="mt-2 text-[0.7rem] text-gray-400">
                          À la suite de la pratique — montant tel que tes points ont franchi des seuils de{' '}
                          {pointsPerCheck} pts.
                        </p>
                      </>
                    ) : row.kind === 'spend' ? (
                      <>
                        <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rose-700">
                          −{row.checks} chèque{row.checks !== 1 ? 's' : ''} (dépense famille)
                        </span>
                        <p className="mt-1 font-semibold text-primary">{row.note}</p>
                      </>
                    ) : (
                      <>
                        <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-sky-800">
                          +{row.checks} chèque{row.checks !== 1 ? 's' : ''} (annulation dépense)
                        </span>
                        <p className="mt-1 text-sm font-medium text-gray-700">
                          {row.note ?? 'Une dépense a été retirée du registre — les chèques redeviennent utilisables.'}
                        </p>
                      </>
                    )}
                    <p className="mt-2 text-xs text-gray-400">{formatDt(row.created_at)}</p>
                  </div>
                  {row.kind === 'spend' ? (
                    <button
                      type="button"
                      onClick={() => void handleRemove(row.redemption_id)}
                      disabled={deletingId === row.redemption_id}
                      className="shrink-0 text-xs font-semibold text-gray-400 hover:text-rose-600 disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
