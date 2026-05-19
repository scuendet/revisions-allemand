'use client'

import Link from 'next/link'

interface SubjectPageHeaderProps {
  userId: string
  subject: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  showChecks?: boolean
  progressHref?: string
  progressLabel?: string
}

export function SubjectPageHeader({
  userId,
  subject,
  subtitle,
  backHref,
  backLabel = '← Matières',
  showChecks = true,
  progressHref,
  progressLabel = 'Progrès →',
}: SubjectPageHeaderProps) {
  const resolvedBackHref = backHref ?? `/${userId}`
  const hasRightLinks = showChecks || !!progressHref

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={resolvedBackHref}
          className="text-sm font-semibold text-gray-400 hover:text-primary transition-colors"
        >
          {backLabel}
        </Link>
        <span className="text-gray-200">|</span>
        <span className="text-sm font-bold text-primary">{subject}</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-primary">{subject}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {hasRightLinks && (
          <div className="flex flex-wrap gap-2 justify-end">
            {showChecks && (
              <Link
                href={`/${userId}/checks`}
                className="text-sm font-semibold text-amber-800 border border-amber-300 rounded-xl px-4 py-2 bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                Chèques
              </Link>
            )}
            {progressHref && (
              <Link
                href={progressHref}
                className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors"
              >
                {progressLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}
