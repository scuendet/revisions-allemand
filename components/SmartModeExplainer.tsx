'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type SmartModeExplainerProps = {
  variant: 'german' | 'tables'
  /** Bump this (e.g. when the user ticks smart mode) to expand the panel once. */
  revealKey?: number
  /** e.g. SmartSelectionPreview — concrete examples for the current form values. */
  preview?: ReactNode
}

/**
 * Inline transparency for "mode intelligent": intent + how priorities are computed.
 * Uses native <details> (no modal).
 */
export function SmartModeExplainer({ variant, revealKey = 0, preview }: SmartModeExplainerProps) {
  const isGerman = variant === 'german'
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const prevReveal = useRef(0)

  useEffect(() => {
    if (revealKey > prevReveal.current && detailsRef.current) {
      detailsRef.current.open = true
    }
    prevReveal.current = revealKey
  }, [revealKey])

  return (
    <details
      ref={detailsRef}
      className="group mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 text-left open:[&_summary_.chevron]:rotate-90"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden hover:bg-slate-100/80 transition-colors">
        <span className="inline-flex items-center gap-2">
          <span className="chevron inline-block text-slate-400 transition-transform duration-150">▸</span>
          Objectif & priorités (transparence)
        </span>
      </summary>
      <div className="border-t border-slate-200/80 px-4 pb-4 pt-3 space-y-3 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-800">Objectif : </span>
          {isGerman ? (
            <>
              concentrer la session sur les mots où tu as le plus besoin d’aide, tout en faisant réapparaître ceux que tu
              n’as pas revus depuis longtemps — tout en restant dans{' '}
              <span className="font-semibold text-slate-800">tes unités cochées</span>.
            </>
          ) : (
            <>
              concentrer la session sur les multiplications les plus fragiles chez toi, et celles que tu n’as pas
              pratiquées récemment — toujours dans{' '}
              <span className="font-semibold text-slate-800">tes tables sélectionnées</span>.
            </>
          )}
        </p>
        <div>
          <p className="font-semibold text-slate-800 mb-1.5">On augmente la priorité quand…</p>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              {isGerman ? "le mot n’a encore aucun essai enregistré" : "tu n’as pas encore d’essai sur cette opération"}{' '}
              <span className="text-slate-400">(priorité « découverte »)</span>
            </li>
            <li>le dernier essai sur cet item est une erreur</li>
            <li>ton taux de réussite sur cet item (dans le temps) est bas</li>
            <li>
              ça fait du temps depuis ton dernier essai sur cet item{' '}
              <span className="text-slate-400">(révision « rouillée »)</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-800 mb-1.5">On diminue un peu la priorité quand…</p>
          <p className="leading-relaxed">
            tu viens de réussir tout juste : l’item reste possible, mais un peu moins pressant tout de suite, pour éviter de
            tourner sur les mêmes victoires fraîches.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 mb-1.5">Comment les questions sont choisies</p>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              <strong className="font-semibold text-slate-700">Session courte :</strong> tirage pondéré parmi ton pool :
              les items à forte priorité ont plus de chances d’être dans la série ; la liste finale est ensuite mélangée.
            </li>
            <li>
              <strong className="font-semibold text-slate-700">« Tout » :</strong> une fois chaque question du pool :
              ordre du plus prioritaire au moins (avec une petite variation aléatoire pour éviter une liste rigide).
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500 border-t border-slate-200/80 pt-3 leading-relaxed">
          <strong className="text-slate-600">Historique pris en compte :</strong>{' '}
          {isGerman
            ? 'uniquement les essais pour le même type de jeu (flashcards, audio ou frappe), car chaque mode répond à tes réponses différemment.'
            : 'uniquement les essais du même mode (carte, audio ou frappe), pour rester cohérent avec ce que tu pratiques.'}{' '}
          <strong className="text-slate-600">Mode intelligent désactivé :</strong> choix aléatoire dans ton pool, sans
          regarder l’historique pour le tirage (les résultats continuent d’être enregistrés).
        </p>
        {preview}
      </div>
    </details>
  )
}
