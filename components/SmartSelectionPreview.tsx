'use client'

import { useCallback, useState } from 'react'

type TablesPreviewRow = {
  id: string
  left: number
  right: number
  answer: number
  weight: number | null
  bullets: string[]
  /** Mécanisme : pourquoi cette question tombe dans l'exemple de série */
  whyPicked?: string[]
}

type GermanPreviewRow = {
  id: number
  unit: number
  unit_title: string
  french: string
  german: string
  weight: number | null
  bullets: string[]
  whyPicked?: string[]
}

type EnglishPreviewRow = {
  id: number
  unit: number
  unit_title: string
  french: string
  english: string
  weight: number | null
  bullets: string[]
  whyPicked?: string[]
}

type PreviewPayload =
  | {
      smart: boolean
      hasUser: boolean
      poolSize: number
      sessionSize: number
      modeFilter: string
      topRanked: TablesPreviewRow[]
      exampleDraw: TablesPreviewRow[]
      note: string
    }
  | {
      smart: boolean
      hasUser: boolean
      poolSize: number
      sessionSize: number
      modeFilter: string
      topRanked: GermanPreviewRow[]
      exampleDraw: GermanPreviewRow[]
      note: string
    }
  | {
      smart: boolean
      hasUser: boolean
      poolSize: number
      sessionSize: number
      modeFilter: string
      topRanked: EnglishPreviewRow[]
      exampleDraw: EnglishPreviewRow[]
      note: string
    }

type Props =
  | {
      variant: 'tables'
      userId: string
      tables: number[]
      mode: 'flashcard' | 'audio' | 'typing'
      count: 10 | 20 | 'all'
      smart: boolean
    }
  | {
      variant: 'german'
      userId: string
      units: number[]
      mode: 'flashcard' | 'audio' | 'typing' | null
      count: 10 | 20 | 'all'
      smart: boolean
    }
  | {
      variant: 'english'
      userId: string
      units: number[]
      mode: 'flashcard' | 'audio' | 'typing' | null
      count: 10 | 20 | 'all'
      smart: boolean
    }

function BulletList({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600 leading-relaxed">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  )
}

export function SmartSelectionPreview(props: Props) {
  const [data, setData] = useState<PreviewPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tablesBlocked = props.variant === 'tables' && props.tables.length === 0
  const unitsBlocked = (props.variant === 'german' || props.variant === 'english') && props.units.length === 0

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    setData(null)
    try {
      if ((props.variant === 'german' || props.variant === 'english') && props.units.length === 0) {
        setError('Coche au moins une unité pour cet aperçu.')
        setLoading(false)
        return
      }
      if ((props.variant === 'german' || props.variant === 'english') && !props.mode) {
        setError("Choisis d'abord un mode (étape 3) : l'aperçu utilise le même mode que la session.")
        setLoading(false)
        return
      }
      const uid = parseInt(props.userId, 10)
      const url = props.variant === 'tables'
        ? '/api/tables/preview'
        : props.variant === 'english'
          ? '/api/english/preview'
          : '/api/quiz/preview'
      const body =
        props.variant === 'tables'
          ? {
              tables: props.tables,
              mode: props.mode,
              count: props.count,
              user_id: uid,
              smart: props.smart,
            }
          : {
              units: props.units,
              mode: props.mode!,
              count: props.count,
              user_id: uid,
              smart: props.smart,
            }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await r.json()
      if (!r.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Aperçu indisponible.')
        return
      }
      setData(json as PreviewPayload)
    } catch {
      setError('Réseau ou fichier indisponible.')
    } finally {
      setLoading(false)
    }
  }, [props])

  const germanBlocked = (props.variant === 'german' || props.variant === 'english') && !props.mode

  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Aperçu concret pour ta sélection</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Données réelles issues de tes fichiers d'historique (même logique que le bouton Commencer).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || germanBlocked || tablesBlocked || unitsBlocked}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Chargement…' : 'Charger un aperçu'}
        </button>
      </div>
      {unitsBlocked && <p className="text-xs text-amber-700 mt-3">Coche au moins une unité.</p>}
      {tablesBlocked && <p className="text-xs text-amber-700 mt-3">Choisis au moins une table.</p>}
      {germanBlocked && !unitsBlocked && (
        <p className="text-xs text-amber-700 mt-3">Sélectionne un mode d'abord pour aligner l'historique.</p>
      )}
      {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}

      {data && (
        <div className="mt-4 space-y-4 text-left">
          <p className="text-xs text-slate-500 leading-relaxed">{data.note}</p>
          <p className="text-xs text-slate-600">
            Pool : <span className="font-semibold">{data.poolSize}</span> · Taille de la série :{' '}
            <span className="font-semibold">{data.sessionSize}</span> · Filtre historique :{' '}
            <span className="font-semibold">{data.modeFilter}</span>
          </p>

          {data.smart && data.hasUser && data.topRanked.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Top des priorités (score le plus haut en premier)
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {data.topRanked.map((row, idx) => (
                  <div key={`${row.id}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                    {props.variant === 'tables' ? (
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {(row as TablesPreviewRow).left} × {(row as TablesPreviewRow).right} ={' '}
                        {(row as TablesPreviewRow).answer}
                        <span className="ml-2 font-sans text-xs font-semibold text-slate-500">
                          · score ≈ {row.weight?.toFixed(1)}
                        </span>
                      </p>
                    ) : props.variant === 'english' ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {(row as EnglishPreviewRow).english}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (unité {(row as EnglishPreviewRow).unit})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{(row as EnglishPreviewRow).french}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">score ≈ {row.weight?.toFixed(1)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {(row as GermanPreviewRow).german}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (unité {(row as GermanPreviewRow).unit})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{(row as GermanPreviewRow).french}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">score ≈ {row.weight?.toFixed(1)}</p>
                      </div>
                    )}
                    <BulletList lines={row.bullets} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.exampleDraw.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Exemple de tour (comme une vraie série)
              </p>
              <div className="space-y-2">
                {data.exampleDraw.map((row, idx) => (
                  <div key={`ex-${row.id}-${idx}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Question {idx + 1}</p>
                    {props.variant === 'tables' ? (
                      <p className="font-mono text-base font-bold text-primary">
                        {(row as TablesPreviewRow).left} × {(row as TablesPreviewRow).right} = ?
                      </p>
                    ) : props.variant === 'english' ? (
                      <div>
                        <p className="text-sm text-slate-600">{(row as EnglishPreviewRow).french}</p>
                        <p className="text-xs text-slate-400">cible : {(row as EnglishPreviewRow).english}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-600">{(row as GermanPreviewRow).french}</p>
                        <p className="text-xs text-slate-400">cible : {(row as GermanPreviewRow).german}</p>
                      </div>
                    )}
                    {row.whyPicked && row.whyPicked.length > 0 && (
                      <div className="mt-2 border-l-2 border-slate-700 pl-3">
                        <p className="text-xs font-bold text-slate-800">Pourquoi elle est dans cet exemple</p>
                        <BulletList lines={row.whyPicked} />
                      </div>
                    )}
                    <p className="text-xs font-bold text-slate-600 mt-2">Données qui alimentent le poids</p>
                    <BulletList lines={row.bullets} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
